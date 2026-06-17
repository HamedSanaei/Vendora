using Domain.Entities;

namespace Persistence.Carts;

/// <summary>
/// Provides cart persistence operations.
/// </summary>
public interface ICartRepository
{
    /// <summary>
    /// Returns a cart for a user if one exists.
    /// </summary>
    Task<Cart?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds a new cart to persistence.
    /// </summary>
    Task AddAsync(Cart cart, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes all items from a cart.
    /// </summary>
    void ClearItems(Cart cart);
}
