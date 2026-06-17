namespace Application.Products.DTOs;

/// <summary>
/// Represents the detailed product shape used by detail pages.
/// </summary>
public sealed record ProductDetailDto(
    Guid Id,
    string Title,
    string Slug,
    string? Description,
    decimal Price,
    int StockQuantity,
    string? CategoryName,
    IReadOnlyList<ProductImageDto> Images);
