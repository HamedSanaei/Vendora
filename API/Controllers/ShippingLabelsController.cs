using Application.Interfaces;
using Application.Orders;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>Private administrator logistics documents; labels do not initiate shipment or alter business records.</summary>
[ApiController, Authorize(Policy = "AdminOnly"), Route("api/admin/orders"), ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ShippingLabelsController(ISender sender) : ControllerBase
{
    /// <summary>Returns the same in-memory A5 document used for both browser printing and downloads.</summary>
    [HttpGet("{id:guid}/shipping-label/pdf")]
    public Task<IActionResult> One(Guid id, CancellationToken ct) => Render([id], ct);

    /// <summary>Preserves selection order, removes duplicates and validates all orders before producing a PDF.</summary>
    [HttpPost("shipping-labels/pdf"), RequestSizeLimit(32 * 1024)]
    public Task<IActionResult> Batch(BatchInput input, CancellationToken ct) => Render(input.OrderIds, ct);

    /// <summary>Maps only safe application errors; raw renderer exceptions or private addresses never enter error responses.</summary>
    private async Task<IActionResult> Render(IReadOnlyList<Guid> ids, CancellationToken ct)
    {
        try
        {
            var result = await sender.Send(new ShippingLabels.Query(ids), ct);
            Response.Headers.CacheControl = "no-store"; Response.Headers.Pragma = "no-cache";
            return File(result.Bytes, "application/pdf", result.FileName);
        }
        catch (ShippingLabels.LabelException error)
        { return StatusCode(error.Status, new { code = error.Code, error.OrderNumber, error.Fields }); }
        catch (DocumentRenderUnavailableException error)
        { return StatusCode(503, new { code = error.Code }); }
    }

    public sealed record BatchInput(IReadOnlyList<Guid> OrderIds);
}
