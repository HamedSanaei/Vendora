using System.Security.Claims;
using Application.Accounting;
using Application.Shipping;
using Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>Thin shipping policy and quotation adapter; all calculations and ownership checks live in Application.</summary>
[ApiController, Route("api/shipping"), ResponseCache(NoStore = true, Location = ResponseCacheLocation.None), ShippingErrors]
public sealed class ShippingController(ISender sender) : ControllerBase
{
    [HttpGet("policy"), AllowAnonymous]
    public async Task<ActionResult<ShippingUseCases.PublicState>> Policy(CancellationToken ct)
    {
        var state = await sender.Send(new ShippingUseCases.Read(), ct);
        return Ok(new ShippingUseCases.PublicState(state.Policy.IncludedInPrice, state.Policy.UnitAmount, state.Policy.Version));
    }

    /// <summary>Returns authoritative cart discount totals without an address, authentication or carrier traffic.</summary>
    [HttpPost("cart-pricing"), AllowAnonymous]
    public async Task<ActionResult<ShippingUseCases.QuoteResult>> CartPricing(CartPricingInput input, CancellationToken ct)
        => Ok(await sender.Send(new ShippingUseCases.CartPricing(input.Items, input.CouponCode), ct));

    [HttpGet("~/api/admin/store-settings/shipping"), Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ShippingUseCases.Settings>> Settings(CancellationToken ct) => Ok(await sender.Send(new ShippingUseCases.Read(true), ct));

    [HttpPut("~/api/admin/store-settings/shipping"), Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<ShippingUseCases.Settings>> Save(ShippingSettingsInput input, CancellationToken ct)
        => Ok(await sender.Send(new ShippingUseCases.Save(input.Policy, input.Packages), ct));

    [HttpPut("~/api/admin/products/{id:guid}/shipping-weight"), Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Weight(Guid id, WeightInput input, CancellationToken ct)
    { await sender.Send(new ShippingUseCases.Weight(id, input.WeightGrams), ct); return NoContent(); }

    [HttpGet("reference/{resource}"), Authorize]
    public async Task<IActionResult> Reference(string resource, CancellationToken ct) => Ok(await sender.Send(new ShippingUseCases.Reference(resource), ct));

    [HttpPost("quote"), Authorize]
    public async Task<ActionResult<ShippingUseCases.QuoteResult>> Quote(ShippingQuoteInput input, CancellationToken ct)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var user)) return Unauthorized();
        return Ok(await sender.Send(new ShippingUseCases.Quote(user, input.AddressId, input.Items, input.Method, input.CouponCode, input.DestinationCityCode), ct));
    }

    public sealed record ShippingSettingsInput(ShippingPolicy Policy, IReadOnlyList<ShippingPackage> Packages);
    public sealed record WeightInput(int? WeightGrams);
    public sealed record CartPricingInput(IReadOnlyList<CartQuoteItem> Items, string? CouponCode = null);
    public sealed record ShippingQuoteInput(Guid AddressId, IReadOnlyList<CartQuoteItem> Items, string Method, string? CouponCode = null, string? DestinationCityCode = null);
}

/// <summary>Maps stable use-case errors without exposing carrier responses, credentials or stack traces.</summary>
public sealed class ShippingErrorsAttribute : Microsoft.AspNetCore.Mvc.Filters.ExceptionFilterAttribute
{
    public override void OnException(Microsoft.AspNetCore.Mvc.Filters.ExceptionContext context)
    {
        if (context.Exception is AccountingException error)
        { context.Result = new ObjectResult(new { code = error.Code }) { StatusCode = error.Status }; context.ExceptionHandled = true; }
        else if (context.Exception is Application.Pricing.PriceChangedException price)
        { context.Result = new ObjectResult(new { code = "PRICE_CHANGED", productId = price.ProductId, currentPrice = price.CurrentPrice }) { StatusCode = 409 }; context.ExceptionHandled = true; }
    }
}
