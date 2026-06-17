using Domain.Entities;

namespace Persistence.Products;

/// <summary>
/// Provides persistence-side product read operations for application use cases.
/// </summary>
public interface IProductReadRepository
{
    /// <summary>
    /// Returns all active products with related data needed by read use cases.
    /// </summary>
    Task<IReadOnlyList<Product>> GetActiveProductsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns one active product by slug with related data needed by read use cases.
    /// </summary>
    Task<Product?> GetActiveProductBySlugAsync(string slug, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns one active product by identifier.
    /// </summary>
    Task<Product?> GetActiveProductByIdAsync(Guid productId, CancellationToken cancellationToken = default);
}
