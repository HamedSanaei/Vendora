using Domain.Entities;

namespace Persistence.Orders;

/// <summary>
/// Provides order persistence operations.
/// </summary>
public interface IOrderRepository
{
    /// <summary>
    /// Adds a new order to persistence.
    /// </summary>
    Task AddAsync(Order order, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns orders for a user.
    /// </summary>
    Task<IReadOnlyList<Order>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns an order by public order number.
    /// </summary>
    Task<Order?> GetByOrderNumberAsync(string orderNumber, CancellationToken cancellationToken = default);
}
