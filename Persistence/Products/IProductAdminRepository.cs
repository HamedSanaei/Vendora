using Domain.Entities;

namespace Persistence.Products;

/// <summary>
/// Provides product persistence operations needed by admin use cases.
/// </summary>
public interface IProductAdminRepository
{
    /// <summary>
    /// Returns all products with admin management data.
    /// </summary>
    Task<IReadOnlyList<Product>> GetProductsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns one product for admin editing.
    /// </summary>
    Task<Product?> GetProductAsync(Guid id, bool trackChanges, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns all active categories for admin product forms.
    /// </summary>
    Task<IReadOnlyList<Category>> GetCategoriesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns whether a product slug is already in use.
    /// </summary>
    Task<bool> SlugExistsAsync(string slug, Guid? ignoredProductId = null, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns whether a category exists.
    /// </summary>
    Task<bool> CategoryExistsAsync(Guid categoryId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns whether every category id exists.
    /// </summary>
    Task<bool> CategoriesExistAsync(IReadOnlyCollection<Guid> categoryIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns whether a brand exists.
    /// </summary>
    Task<bool> BrandExistsAsync(Guid brandId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Returns whether every color id exists.
    /// </summary>
    Task<bool> ColorsExistAsync(IReadOnlyCollection<Guid> colorIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Adds a new product aggregate.
    /// </summary>
    Task AddAsync(Product product, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes all images for a product.
    /// </summary>
    void RemoveImages(Product product);

    /// <summary>
    /// Removes selected images for a product.
    /// </summary>
    void RemoveImages(Product product, IReadOnlyCollection<Guid> imageIds);

    /// <summary>
    /// Replaces color links for a tracked product.
    /// </summary>
    void ReplaceColors(Product product, IReadOnlyCollection<Guid> colorIds);

    /// <summary>
    /// Replaces category links for a tracked product.
    /// </summary>
    void ReplaceCategories(Product product, IReadOnlyCollection<Guid> categoryIds);
}
