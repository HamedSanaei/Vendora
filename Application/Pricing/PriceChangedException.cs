namespace Application.Pricing;

/// <summary>Signals that a dollar-priced line must be shown again before the customer confirms it.</summary>
public sealed class PriceChangedException(Guid productId, decimal currentPrice)
    : Exception("The product price has changed. Review the updated price before confirming the order.")
{
    public Guid ProductId { get; } = productId;
    public decimal CurrentPrice { get; } = currentPrice;
}
