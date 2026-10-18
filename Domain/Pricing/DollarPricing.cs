namespace Domain.Pricing;

/// <summary>Converts a dollar-denominated unit price to a whole 10,000 Toman increment.</summary>
public static class DollarPricing
{
    public const decimal RoundingStep = 10_000m;
    public const decimal MaximumUsdPrice = 1_000_000m;
    public const decimal MaximumExchangeRate = 1_000_000_000m;

    /// <summary>Validates the supported precision and range of a dollar unit price.</summary>
    public static bool IsValidUsdPrice(decimal price) =>
        price > 0 && price <= MaximumUsdPrice && decimal.Round(price, 4) == price;

    /// <summary>Rounds upward once per unit; an exact increment remains unchanged.</summary>
    public static decimal ToToman(decimal usdPrice, decimal tomanPerUsdt)
    {
        if (!IsValidUsdPrice(usdPrice)) throw new ArgumentOutOfRangeException(nameof(usdPrice));
        if (tomanPerUsdt <= 0 || tomanPerUsdt > MaximumExchangeRate)
            throw new ArgumentOutOfRangeException(nameof(tomanPerUsdt));

        return decimal.Ceiling(usdPrice * tomanPerUsdt / RoundingStep) * RoundingStep;
    }
}
