namespace Application.Products.DTOs;

/// <summary>
/// Represents a product row used by admin catalog screens.
/// </summary>
public sealed record AdminProductDto(
    Guid Id,
    string Title,
    string Slug,
    string? Description,
    decimal Price,
    int StockQuantity,
    string Status,
    string InventoryStatus,
    Guid? CategoryId,
    string? CategoryName,
    IReadOnlyList<ProductCategoryDto> Categories,
    Guid? BrandId,
    string? BrandName,
    string? PrimaryImageUrl,
    IReadOnlyList<ProductImageDto> Images,
    IReadOnlyList<CatalogColorDto> Colors);
