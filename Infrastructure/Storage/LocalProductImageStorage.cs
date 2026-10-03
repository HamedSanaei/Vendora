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

        string webRootPath = GetWebRootPath();

        string uploadDirectory = Path.Combine(webRootPath, "uploads", "products");
        Directory.CreateDirectory(uploadDirectory);

        string fileName = $"{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        string destinationPath = Path.Combine(uploadDirectory, fileName);

        try
        {
            await using Stream source = upload.OpenReadStream();
            await using (var destination = File.Create(destinationPath))
            {
                await source.CopyToAsync(destination, cancellationToken);
            }

            return new StoredProductImage($"/uploads/products/{fileName}");
        }
        catch
        {
            await DeleteAsync($"/uploads/products/{fileName}", CancellationToken.None);
            throw;
        }
    }

    /// <inheritdoc />
    public Task DeleteAsync(string imageUrl, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        const string prefix = "/uploads/products/";
        if (!imageUrl.StartsWith(prefix, StringComparison.Ordinal))
        {
            return Task.CompletedTask;
        }

        string fileName = imageUrl[prefix.Length..];
        string extension = Path.GetExtension(fileName);
        string stem = Path.GetFileNameWithoutExtension(fileName);
        // Only generated filenames are owned: no directories, query strings, or arbitrary assets.
        if (!AllowedExtensions.Contains(extension)
            || stem.Length != 32
            || !Guid.TryParseExact(stem, "N", out _)
            || fileName != stem + extension)
        {
            return Task.CompletedTask;
        }

        try
        {
            File.Delete(Path.Combine(GetWebRootPath(), "uploads", "products", fileName));
        }
        catch (IOException)
        {
            // A committed database change must not fail because file cleanup was unavailable.
        }
        catch (UnauthorizedAccessException)
        {
            // Best-effort cleanup; never broaden permissions or delete outside owned storage.
        }

        return Task.CompletedTask;
    }

    /// <summary>Resolves the hosting web root without taking any client-controlled path input.</summary>
    private string GetWebRootPath()
    {
        return string.IsNullOrWhiteSpace(_environment.WebRootPath)
            ? Path.Combine(_environment.ContentRootPath, "wwwroot")
            : _environment.WebRootPath;
    }
}
