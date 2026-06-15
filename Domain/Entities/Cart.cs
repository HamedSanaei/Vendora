using Domain.Common;

namespace Domain.Entities;

/// <summary>
/// Represents a customer's shopping cart.
/// </summary>
public class Cart : AuditableEntity
{
    /// <summary>
    /// Gets or sets the optional customer identifier.
    /// </summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// Gets the cart items.
    /// </summary>
    public List<CartItem> Items { get; set; } = [];
}
