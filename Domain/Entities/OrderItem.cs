using Domain.Common;

namespace Domain.Entities;

/// <summary>
/// Represents a purchased product line on an order.
/// </summary>
public class OrderItem : EntityBase
{
    /// <summary>
    /// Gets or sets the owning order identifier.
    /// </summary>
    public Guid OrderId { get; set; }

    /// <summary>
    /// Gets or sets the parent order.
    /// </summary>
    public Order Order { get; set; } = null!;

    /// <summary>
    /// Gets or sets the product identifier.
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Gets or sets the product title snapshot.
    /// </summary>
    public string ProductTitle { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the unit price snapshot used at checkout.
    /// </summary>
    public decimal UnitPrice { get; set; }

    /// <summary>
    /// Gets or sets the quantity purchased.
    /// </summary>
    public int Quantity { get; set; }

    /// <summary>
    /// Gets the line total for this item.
    /// </summary>
    public decimal LineTotal => UnitPrice * Quantity;
}
