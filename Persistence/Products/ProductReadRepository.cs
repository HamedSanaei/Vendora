using Domain.Common;
using Domain.Entities;
using Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Persistence.Products;

/// <summary>
/// EF Core implementation of product read operations.
/// </summary>
public sealed class ProductReadRepository : IProductReadRepository
{
    private readonly AppDbContext _dbContext;

    /// <summary>
    /// Creates a product read repository.
    /// </summary>
    /// <param name="dbContext">The EF Core database context.</param>
    public ProductReadRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Product>> GetActiveProductsAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.Products
            .AsNoTracking()
            .Include(product => product.Category)
            .Include(product => product.Images)
            .Where(product => product.Status == ProductStatus.Active)
            .OrderBy(product => product.Title)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Product?> GetActiveProductBySlugAsync(string slug, CancellationToken cancellationToken = default)
    {
        string normalizedSlug = SlugHelper.ToSlug(slug);

        return await _dbContext.Products
            .AsNoTracking()
            .Include(product => product.Category)
            .Include(product => product.Images)
            .FirstOrDefaultAsync(
                product => product.Slug == normalizedSlug && product.Status == ProductStatus.Active,
                cancellationToken);
    }

    /// <inheritdoc />
    public async Task<Product?> GetActiveProductByIdAsync(Guid productId, CancellationToken cancellationToken = default)
    {
        return await _dbContext.Products
            .Include(product => product.Category)
            .Include(product => product.Images)
            .FirstOrDefaultAsync(
                product => product.Id == productId && product.Status == ProductStatus.Active,
                cancellationToken);
    }
}
