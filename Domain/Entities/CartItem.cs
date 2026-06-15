using Domain.Common;

namespace Domain.Entities;

/// <summary>
/// Represents a product line inside a shopping cart.
/// </summary>
public class CartItem : EntityBase
{
    /// <summary>
    /// Gets or sets the cart identifier.
    /// </summary>
    public Guid CartId { get; set; }

    /// <summary>
    /// Gets or sets the cart.
    /// </summary>
    public Cart Cart { get; set; } = null!;

    /// <summary>
    /// Gets or sets the product identifier.
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Gets or sets the product snapshot title used for display.
    /// </summary>
    public string ProductTitle { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the product price captured when the item was added.
    /// </summary>
    public decimal UnitPrice { get; set; }

    /// <summary>
    /// Gets or sets the quantity.
    /// </summary>
    public int Quantity { get; set; }
}
