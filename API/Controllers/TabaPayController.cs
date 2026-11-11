using System.Security.Claims;
using System.Text.Json;
using Application.Accounting;
using Application.Payments;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

/// <summary>Exposes authenticated payment actions and the two TabaPay callback methods.</summary>
[ApiController]
[Route("api/payments/tabapay")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TabaPayController(ISender sender) : ControllerBase
{
    [HttpGet("availability"), AllowAnonymous]
    public async Task<IActionResult> Availability(CancellationToken ct) =>
        Ok(await sender.Send(new TabaPayPayments.Availability(), ct));

    [HttpPost("orders/{orderNumber}/start"), Authorize, EnableRateLimiting("payment-start")]
    public async Task<IActionResult> Start(string orderNumber, StartInput input, CancellationToken ct)
    {
        if (!TryUser(out var user)) return Unauthorized();
        try { return Ok(await sender.Send(new TabaPayPayments.Start(user, orderNumber, input.Locale), ct)); }
        catch (AccountingException e) { return Failure(e); }
    }

    [HttpGet("orders/{orderNumber}"), Authorize]
    public async Task<IActionResult> Read(string orderNumber, CancellationToken ct)
    {
        if (!TryUser(out var user)) return Unauthorized();
        try { return Ok(await sender.Send(new TabaPayPayments.Read(user, orderNumber), ct)); }
        catch (AccountingException e) { return Failure(e); }
    }

    [HttpPost("orders/{orderNumber}/check"), Authorize, EnableRateLimiting("payment-start")]
    public async Task<IActionResult> Recheck(string orderNumber, StartInput input, CancellationToken ct)
    {
        if (!TryUser(out var user)) return Unauthorized();
        try { return Ok(await sender.Send(new TabaPayPayments.Recheck(user, orderNumber, input.Locale), ct)); }
        catch (AccountingException e) { return Failure(e); }
    }

    /// <summary>Browser returns are signals only. Query status and amount are never used for verification.</summary>
    [HttpGet("callback/{locale}/{id:guid}"), AllowAnonymous, EnableRateLimiting("payment-callback")]
    public async Task<IActionResult> Return(string locale, Guid id, [FromQuery] string? token, CancellationToken ct)
    {
        try
        {
            var result = await sender.Send(new TabaPayPayments.Callback(id, locale, token), ct);
            return Redirect(result.Destination.AbsoluteUri);
        }
        catch (AccountingException e) { return Failure(e); }
    }

    /// <summary>Acknowledges the issuer only after evidence has been saved.</summary>
    [HttpPost("callback/{locale}/{id:guid}"), AllowAnonymous, EnableRateLimiting("payment-callback"), RequestSizeLimit(16 * 1024)]
    public async Task<IActionResult> Notification(string locale, Guid id, [FromBody] JsonElement body, CancellationToken ct)
    {
        // PHP exposes the wire header Authorize as HTTP_AUTHORIZE.
        var headers = Request.Headers["Authorize"].Concat(Request.Headers["HTTP_AUTHORIZE"]).ToArray();
        try
        {
            await sender.Send(new TabaPayPayments.Callback(id, locale, null, headers.Length == 1 ? headers[0] : null, body), ct);
            return Ok(new { status = "success" });
        }
        catch (AccountingException e) { return Failure(e); }
    }

    private bool TryUser(out Guid user) => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out user);
    private ObjectResult Failure(AccountingException error) => StatusCode(error.Status, new { code = error.Code });
    public sealed record StartInput(string Locale);
}
