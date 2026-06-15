namespace Domain.ValueObjects;

/// <summary>
/// Represents a monetary amount with a currency code.
/// </summary>
public readonly record struct Money(decimal Amount, string CurrencyCode)
{
    /// <summary>
    /// Creates a new money value.
    /// </summary>
    public static Money Of(decimal amount, string currencyCode) => new(amount, currencyCode);
}
