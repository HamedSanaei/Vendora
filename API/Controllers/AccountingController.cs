using System.Security.Claims;
using Application.Accounting;
using Domain.Accounting;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Application.Interfaces;

namespace API.Controllers;

/// <summary>Role-protected accounting adapter; every operation delegates to a focused command/query.</summary>
[ApiController, Authorize(Policy = "AdminOnly"), Route("api/admin/accounting")]
public sealed class AccountingController(ISender sender) : ControllerBase
{
    /// <summary>Reads real module balances and commercial totals.</summary>
    [HttpGet("overview")]
    public async Task<ActionResult> Overview(DateTime? fromUtc, DateTime? toUtc, CancellationToken ct) => Ok(await sender.Send(new AccountingQueries.Overview(fromUtc, toUtc), ct));
    /// <summary>Reads activation only for existing stock-edit access controls.</summary>
    [HttpGet("status")]
    public async Task<ActionResult> Status(CancellationToken ct) => Ok(await sender.Send(new AccountingQueries.Status(), ct));
    /// <summary>Loads metrics for the requested document family only.</summary>
    [HttpGet("documents/summary")]
    public async Task<ActionResult> DocumentSummary(DocumentKind kind, DateTime? fromUtc, DateTime? toUtc, CancellationToken ct)
        => Ok(await sender.Send(new AccountingSummaries.Documents(kind, fromUtc, toUtc), ct));
    /// <summary>Reads counterparty identity and balance counts.</summary>
    [HttpGet("counterparties/summary")]
    public async Task<ActionResult> PartySummary(CancellationToken ct) => Ok(await sender.Send(new AccountingSummaries.Parties(), ct));
    /// <summary>Reads receipt/payment and unapplied-funds metrics.</summary>
    [HttpGet("settlements/summary")]
    public async Task<ActionResult> SettlementSummary(CancellationToken ct) => Ok(await sender.Send(new AccountingSummaries.Settlements(), ct));
    /// <summary>Reads true global inventory counts/valuation.</summary>
    [HttpGet("inventory/summary")]
    public async Task<ActionResult> InventorySummary(CancellationToken ct) => Ok(await sender.Send(new AccountingSummaries.Inventory(), ct));
    /// <summary>Lists documents with stable URL filters and pagination.</summary>
    [HttpGet("documents")]
    public async Task<ActionResult> Documents(DocumentKind? kind, DocumentStatus? status, string? search, int page = 1, int pageSize = 25,
        Guid? counterpartyId = null, DocumentCurrency? currency = null, DateTime? fromUtc = null, DateTime? toUtc = null, CancellationToken ct = default)
        => Ok(await sender.Send(new AccountingQueries.Documents(kind, status, search, page, pageSize, counterpartyId, currency, fromUtc, toUtc), ct));
    /// <summary>Reads one authorized internal document.</summary>
    [HttpGet("documents/{id:guid}")]
    public async Task<ActionResult> Document(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new AccountingQueries.Document(id), ct); return result is null ? NotFound() : Ok(result);
    }
    /// <summary>Reads remaining original quantities and settlement amounts without mutating the document.</summary>
    [HttpGet("documents/{id:guid}/context")]
    public async Task<ActionResult> DocumentContext(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new AccountingQueries.DocumentContext(id), ct);
        return result is null ? NotFound() : Ok(result);
    }
    /// <summary>Downloads only posted sales/proforma snapshots with the same renderer as the customer endpoint.</summary>
    [HttpGet("documents/{id:guid}/pdf")]
    public async Task<ActionResult> Pdf(Guid id, DocumentPaperSize size = DocumentPaperSize.A4, CancellationToken ct = default)
    {
        try
        {
            var result = await sender.Send(new DocumentPdf.Query(id, Actor(), true, size), ct);
            Response.Headers.CacheControl = "private, no-store";
            return result is null ? NotFound() : File(result.Bytes, "application/pdf", result.FileName);
        }
        catch (DocumentRenderUnavailableException e) { return StatusCode(503, new { code = e.Code }); }
        catch (AccountingException e) { return StatusCode(e.Status, new { code = e.Code }); }
    }
    /// <summary>Creates/edits a draft without financial/stock effects.</summary>
    [HttpPost("documents")]
    public Task<ActionResult> Draft(DraftInput input, [FromHeader(Name = "Idempotency-Key")] string key, CancellationToken ct)
        => Write(new DocumentCommands.SaveDraft(Actor(), key, input), ct);
    /// <summary>Posts a versioned draft atomically.</summary>
    [HttpPost("documents/{id:guid}/post")]
    public Task<ActionResult> Post(Guid id, VersionRequest input, [FromHeader(Name = "Idempotency-Key")] string key, CancellationToken ct)
        => Write(new DocumentCommands.Post(Actor(), key, id, input.Version), ct);
    /// <summary>Voids an unposted draft; finalized documents cannot be edited/deleted.</summary>
    [HttpPost("documents/{id:guid}/void-draft")]
    public Task<ActionResult> Void(Guid id, VersionRequest input, [FromHeader(Name = "Idempotency-Key")] string key, CancellationToken ct)
        => Write(new DocumentCommands.VoidDraft(Actor(), key, id, input.Version), ct);
    /// <summary>Lists explicit customer/supplier identities.</summary>
    [HttpGet("counterparties")]
    public async Task<ActionResult> Parties(string? search, int page = 1, CancellationToken ct = default)
        => Ok(await sender.Send(new AccountingQueries.Parties(search, page), ct));
    /// <summary>Persists a party with optimistic version checking.</summary>
    [HttpPost("counterparties")]
    public Task<ActionResult> Party(PartyInput input, [FromHeader(Name = "Idempotency-Key")] string key, CancellationToken ct)
        => Write(new PartyCommands.Save(Actor(), key, input), ct);
    /// <summary>Reads the immutable party ledger and total balance.</summary>
    [HttpGet("counterparties/{id:guid}")]
    public async Task<ActionResult> PartyDetail(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new AccountingQueries.Party(id), ct);
        return result is null ? NotFound() : Ok(result);
    }
    /// <summary>Reads the immutable party ledger and total balance.</summary>
    [HttpGet("counterparties/{id:guid}/ledger")]
    public async Task<ActionResult> Ledger(Guid id, int page = 1, CancellationToken ct = default)
    {
        var result = await sender.Send(new AccountingQueries.Ledger(id, page), ct); return result is null ? NotFound() : Ok(result);
    }
    /// <summary>Lists actual receipts/payments, not inferred or fabricated gateway success.</summary>
    [HttpGet("settlements")]
    public async Task<ActionResult> Settlements(Guid? counterpartyId, int page = 1, CancellationToken ct = default)
        => Ok(await sender.Send(new AccountingQueries.Settlements(counterpartyId, page), ct));
    /// <summary>Records manual money evidence; verified gateway is not a client-selectable method.</summary>
    [HttpPost("settlements")]
    public Task<ActionResult> Settlement(SettlementInput input, [FromHeader(Name = "Idempotency-Key")] string key, CancellationToken ct)
        => Write(new PartyCommands.ReceiveOrPay(Actor(), key, input), ct);
    /// <summary>Partially allocates existing money to eligible invoices.</summary>
    [HttpPost("settlements/{id:guid}/allocations")]
    public Task<ActionResult> Allocate(Guid id, AllocationRequest input, [FromHeader(Name = "Idempotency-Key")] string key, CancellationToken ct)
        => Write(new PartyCommands.Allocate(Actor(), key, id, input.Items), ct);
    /// <summary>Lists immutable stock movement/reservation evidence.</summary>
    [HttpGet("movements")]
    public async Task<ActionResult> Movements(Guid? productId, int page = 1, CancellationToken ct = default)
        => Ok(await sender.Send(new AccountingQueries.Movements(productId, page), ct));
    /// <summary>Lists physical, reserved and available inventory with decimal valuation.</summary>
    [HttpGet("inventory")]
    public async Task<ActionResult> Inventory(int page = 1, Guid? productId = null, CancellationToken ct = default)
        => Ok(await sender.Send(new AccountingQueries.Inventory(page, productId), ct));
    /// <summary>Reads internal per-invoice historical purchase/sales prices; never available through customer routes.</summary>
    [HttpGet("reports/products/{productId:guid}/prices")]
    public async Task<ActionResult> ProductPrices(Guid productId, int page = 1, CancellationToken ct = default)
        => Ok(await sender.Send(new AccountingQueries.ProductPrices(productId, page), ct));
    /// <summary>Reports merchandise gross profit only where original costs are known.</summary>
    [HttpGet("reports/product-profit")]
    public async Task<ActionResult> ProductProfit(DateTime? fromUtc, DateTime? toUtc, int page = 1, CancellationToken ct = default)
        => Ok(await sender.Send(new AccountingReports.ProductProfit(fromUtc, toUtc, page), ct));
    /// <summary>Reads actual accounting context for the existing admin order-details screen.</summary>
    [HttpGet("orders/{orderId:guid}/context")]
    public async Task<ActionResult> OrderContext(Guid orderId, CancellationToken ct)
    {
        var result = await sender.Send(new AccountingQueries.OrderContext(orderId), ct);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Posts an audited stock adjustment instead of directly overwriting product quantity.</summary>
    [HttpPost("inventory/{productId:guid}/adjustments")]
    public Task<ActionResult> Adjust(Guid productId, AdjustmentRequest input, [FromHeader(Name = "Idempotency-Key")] string key, CancellationToken ct)
        => Write(new InventoryCommands.Adjust(Actor(), key, productId, input.Version, input.QuantityDelta, input.TotalCostToman, input.Reason), ct);

    /// <summary>Previews existing quantities/open orders; does not initialize or reconcile anything.</summary>
    [HttpGet("setup/preview")]
    public async Task<ActionResult> SetupPreview(CancellationToken ct) => Ok(await sender.Send(new AccountingSetup.Preview(), ct));
    /// <summary>Requires explicit administrator confirmation against an unchanged read-only preview.</summary>
    [HttpPost("setup/activate")]
    public Task<ActionResult> Activate(SetupRequest input, [FromHeader(Name = "Idempotency-Key")] string key, CancellationToken ct)
        => Write(new AccountingSetup.Activate(Actor(), key, input.ProductIds, input.PreviewFingerprint, input.Confirmation), ct);
    /// <summary>Classifies historical verified records; seeded/unproven flags are not adopted as money.</summary>
    [HttpGet("setup/historical-payments")]
    public async Task<ActionResult> Historical(CancellationToken ct) => Ok(await sender.Send(new AccountingSetup.HistoricalPreview(), ct));
    /// <summary>Imports one already-verified historical payment after explicit preview confirmation; it never verifies a gateway.</summary>
    [HttpPost("setup/historical-payments/{id:guid}/reconcile")]
    public Task<ActionResult> Reconcile(Guid id, HistoricalRequest input, CancellationToken ct)
        => Write(new CommercePosting.FinalizeVerifiedPayment(id, Actor(), input.PreviewFingerprint, input.Confirmation), ct);

    /// <summary>Maps safe application errors; never includes a SQL exception or internal cost in customer responses.</summary>
    internal async Task<ActionResult> Write(IRequest<Guid> command, CancellationToken ct)
    {
        try { return Ok(new { id = await sender.Send(command, ct) }); }
        catch (AccountingException e) { return StatusCode(e.Status, new { code = e.Code }); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { code = "STALE_VERSION" }); }
        catch (DbUpdateException) { return Conflict(new { code = "WRITE_CONFLICT" }); }
        catch (ArgumentException) { return BadRequest(new { code = "INVALID_INPUT" }); }
        catch (OverflowException) { return BadRequest(new { code = "AMOUNT_OUT_OF_RANGE" }); }
        catch (InvalidOperationException) { return Conflict(new { code = "INVALID_ACCOUNTING_OPERATION" }); }
    }
    /// <summary>Derives audit actor from the authenticated token, never from the request body.</summary>
    private Guid Actor() => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : Guid.Empty;
    public sealed record VersionRequest(long Version);
    public sealed record AllocationRequest(IReadOnlyList<AllocationInput> Items);
    public sealed record AdjustmentRequest(long Version, int QuantityDelta, decimal? TotalCostToman, string Reason);
    public sealed record SetupRequest(IReadOnlyList<Guid> ProductIds, string PreviewFingerprint, string Confirmation);
    public sealed record HistoricalRequest(string PreviewFingerprint, string Confirmation);
}
