using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Persistence.Carts;

/// <summary>
/// EF Core implementation of cart persistence operations.
/// </summary>
public sealed class CartRepository : ICartRepository
{
    private readonly AppDbContext _dbContext;

    /// <summary>
    /// Creates a cart repository.
    /// </summary>
    public CartRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<Cart?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Carts
            .Include(cart => cart.Items)
            .FirstOrDefaultAsync(cart => cart.UserId == userId, cancellationToken);
    }

    /// <inheritdoc />
    public async Task AddAsync(Cart cart, CancellationToken cancellationToken = default)
    {
        await _dbContext.Carts.AddAsync(cart, cancellationToken);
    }

    /// <inheritdoc />
    public void ClearItems(Cart cart)
    {
        _dbContext.CartItems.RemoveRange(cart.Items);
        cart.Items.Clear();
    }
}
