using Application.Interfaces;
using Microsoft.AspNetCore.Hosting;

namespace Infrastructure.Storage;

/// <summary>
/// Stores product images under the API web root for development and local testing.
/// </summary>
public sealed class LocalProductImageStorage : IProductImageStorage
{
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    };

    private readonly IWebHostEnvironment _environment;

    /// <summary>
    /// Creates the local image storage adapter.
    /// </summary>
    /// <param name="environment">The API hosting environment.</param>
    public LocalProductImageStorage(IWebHostEnvironment environment)
    {
        _environment = environment;
    }

    /// <inheritdoc />
    public async Task<StoredProductImage> SaveAsync(ProductImageUpload upload, CancellationToken cancellationToken = default)
    {
        string extension = Path.GetExtension(upload.FileName);
        if (!AllowedExtensions.Contains(extension))
        {
            throw new InvalidOperationException("Unsupported product image extension.");
        }

        string webRootPath = _environment.WebRootPath;
        if (string.IsNullOrWhiteSpace(webRootPath))
        {
            webRootPath = Path.Combine(_environment.ContentRootPath, "wwwroot");
        }

        string uploadDirectory = Path.Combine(webRootPath, "uploads", "products");
        Directory.CreateDirectory(uploadDirectory);

        string fileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        string destinationPath = Path.Combine(uploadDirectory, fileName);

        await using Stream source = upload.OpenReadStream();
        await using var destination = File.Create(destinationPath);
        await source.CopyToAsync(destination, cancellationToken);

        return new StoredProductImage($"/uploads/products/{fileName}");
    }
}
