namespace Application.Interfaces;

/// <summary>
/// Stores product image files for product management use cases.
/// </summary>
public interface IProductImageStorage
{
    /// <summary>
    /// Stores one uploaded product image and returns its public URL.
    /// </summary>
    /// <param name="upload">The uploaded image metadata and stream factory.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The stored image URL.</returns>
    Task<StoredProductImage> SaveAsync(ProductImageUpload upload, CancellationToken cancellationToken = default);
}
