using Domain.Entities;
using Domain.Pricing;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Pricing;

/// <summary>Applies product pricing from the durable internal rate, without external network access.</summary>
public static class ProductPriceWriter
{
    /// <summary>Validates price input and materializes the Toman price inside the caller's transaction.</summary>
    public static async Task<string?> ApplyAsync(AppDbContext db, Product product, decimal price,
        decimal? usdPrice, CancellationToken cancellationToken)
    {
        if (usdPrice.HasValue && !DollarPricing.IsValidUsdPrice(usdPrice.Value))
            return "Dollar price must be greater than zero, at most 1000000, with at most four decimal places.";
        if (!usdPrice.HasValue && (price <= 0 || price > 1_000_000_000_000_000m))
            return "Product price must be greater than zero and within the supported range.";

        decimal? rate = usdPrice.HasValue
            ? await db.UsdtExchangeRates.AsNoTracking().Select(item => item.TomanPerUsdt).SingleAsync(cancellationToken)
            : null;
        if (usdPrice.HasValue && !rate.HasValue)
            return "Dollar pricing is unavailable until the first successful internal exchange-rate refresh.";

        product.SetPricing(price, usdPrice, rate);
        return null;
    }
}
