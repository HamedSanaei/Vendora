using System.Security.Claims;
using Application.Accounting;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Domain.Accounting;
using Application.Interfaces;

namespace API.Controllers;

/// <summary>Authenticated, ownership-filtered commercial documents; never exposes internal accounting models.</summary>
[ApiController, Authorize, Route("api/account/documents")]
public sealed class CustomerDocumentsController(ISender sender) : ControllerBase
{
    /// <summary>Lists only the current customer's posted sales invoices/proformas.</summary>
    [HttpGet]
    public async Task<ActionResult> Mine(int page = 1, DocumentKind? kind = null, CancellationToken ct = default)
    {
        if (!TryActor(out var actor)) return Unauthorized();
        if (kind.HasValue && kind is not (DocumentKind.Proforma or DocumentKind.Sale)) return BadRequest(new { code = "INVALID_DOCUMENT_KIND" });
        return Ok(await sender.Send(new AccountingQueries.Mine(actor, page, kind), ct));
    }
    /// <summary>Uses the same ownership-filtered document source for viewing and future PDF downloads.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult> One(Guid id, CancellationToken ct)
    {
        if (!TryActor(out var actor)) return Unauthorized();
        var result = await sender.Send(new AccountingQueries.MyDocument(actor, id), ct); return result is null ? NotFound() : Ok(result);
    }
    /// <summary>Downloads only a current-user commercial snapshot; missing PDF configuration does not disable accounting.</summary>
    [HttpGet("{id:guid}/pdf")]
    public async Task<ActionResult> Pdf(Guid id, DocumentPaperSize size = DocumentPaperSize.A4, CancellationToken ct = default)
    {
        if (!TryActor(out var actor)) return Unauthorized();
        try
        {
            var result = await sender.Send(new DocumentPdf.Query(id, actor, false, size), ct);
            Response.Headers.CacheControl = "private, no-store";
            return result is null ? NotFound() : File(result.Bytes, "application/pdf", result.FileName);
        }
        catch (DocumentRenderUnavailableException e) { return StatusCode(503, new { code = e.Code }); }
        catch (AccountingException e) { return StatusCode(e.Status, new { code = e.Code }); }
    }
    /// <summary>Issues a saved quote from real server prices; never takes a buyer id or trusted browser total.</summary>
    [HttpPost("proformas")]
    public async Task<ActionResult> Issue(ProformaRequest input, [FromHeader(Name = "Idempotency-Key")] string key, CancellationToken ct)
    {
        if (!TryActor(out var actor)) return Unauthorized();
        try { return Ok(new { id = await sender.Send(new ProformaCommands.Issue(actor, key, input.Items, input.ShippingMethod, input.CouponCode), ct) }); }
        catch (Application.Auth.CustomerProfileRequiredException) { return StatusCode(403, new { code = "PROFILE_INCOMPLETE" }); }
        catch (AccountingException e) { return StatusCode(e.Status, new { code = e.Code }); }
        catch (Application.Pricing.PriceChangedException e) { return Conflict(new { code = "PRICE_CHANGED", productId = e.ProductId, currentPrice = e.CurrentPrice }); }
        catch (ArgumentException) { return BadRequest(new { code = "INVALID_INPUT" }); }
        catch (OverflowException) { return BadRequest(new { code = "AMOUNT_OUT_OF_RANGE" }); }
        catch (DbUpdateException) { return Conflict(new { code = "WRITE_CONFLICT" }); }
    }
    /// <summary>Reads the trusted subject claim, not a client-supplied ownership flag.</summary>
    private bool TryActor(out Guid actor) => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out actor);
    public sealed record ProformaRequest(IReadOnlyList<CartQuoteItem> Items, string? ShippingMethod = null, string? CouponCode = null);
}
