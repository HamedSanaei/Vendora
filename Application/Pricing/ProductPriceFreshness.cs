using Domain.Entities;
using Domain.Pricing;

namespace Application.Pricing;

/// <summary>Proof that a product's displayed price matches a currently valid internal rate, without polling exchanges.</summary>
public sealed record ProductPriceFreshnessDto(DateTime VerifiedAtUtc, DateTime ExpiresAtUtc);

/// <summary>Determines when the storefront may truthfully label a dollar-priced product as current today.</summary>
public static class ProductPriceFreshness
{
    private static readonly TimeZoneInfo Tehran = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tehran");

    /// <summary>Returns short-lived price confirmation only for stocked dollar products whose materialized price is correct.</summary>
    public static ProductPriceFreshnessDto? Verify(Product product, UsdtExchangeRate? rate, DateTime nowUtc)
    {
        if (product.StockQuantity <= 0 || product.UsdPrice is not { } usd || !DollarPricing.IsValidUsdPrice(usd)
            || rate?.TomanPerUsdt is not { } exchangeRate || exchangeRate <= 0 || exchangeRate > DollarPricing.MaximumExchangeRate
            || rate.UpdatedAtUtc is not { } updatedAt || !string.IsNullOrWhiteSpace(rate.LastError)
            || string.IsNullOrWhiteSpace(rate.Sources) || product.PriceExchangeRate != exchangeRate)
            return null;

        var now = DateTime.SpecifyKind(nowUtc, DateTimeKind.Utc);
        var updated = DateTime.SpecifyKind(updatedAt, DateTimeKind.Utc);
        if (now < updated || now - updated >= RefreshExchangeRate.Interval
            || product.Price != DollarPricing.ToToman(usd, exchangeRate)) return null;
        var expires = updated.Add(RefreshExchangeRate.Interval);

        // This is a verification date, not the product edit date. A quote from shortly before
        // midnight can still validate today's price, but cached "today" labels expire at Tehran midnight.
        var tomorrowInTehran = TimeZoneInfo.ConvertTimeFromUtc(now, Tehran).Date.AddDays(1);
        var midnightUtc = TimeZoneInfo.ConvertTimeToUtc(tomorrowInTehran, Tehran);
        return new(now, expires < midnightUtc ? expires : midnightUtc);
    }
}
