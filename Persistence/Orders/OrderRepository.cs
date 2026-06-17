using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Persistence.Orders;

/// <summary>
/// EF Core implementation of order persistence operations.
/// </summary>
public sealed class OrderRepository : IOrderRepository
{
    private readonly AppDbContext _dbContext;

    /// <summary>
    /// Creates an order repository.
    /// </summary>
    public OrderRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task AddAsync(Order order, CancellationToken cancellationToken = default)
    {
        await _dbContext.Orders.AddAsync(order, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Order>> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Orders
            .AsNoTracking()
            .Include(order => order.Items)
            .Where(order => order.UserId == userId)
            .OrderByDescending(order => order.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Order?> GetByOrderNumberAsync(string orderNumber, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Orders
            .AsNoTracking()
            .Include(order => order.Items)
            .FirstOrDefaultAsync(order => order.OrderNumber == orderNumber, cancellationToken);
    }
}
