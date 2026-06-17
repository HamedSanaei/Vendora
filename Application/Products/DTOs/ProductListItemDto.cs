namespace Application.Products.DTOs;

/// <summary>
/// Represents the product shape used for lists and cards.
/// </summary>
public sealed record ProductListItemDto(
    Guid Id,
    string Title,
    string Slug,
    decimal Price,
    int StockQuantity,
    string? CategoryName,
    string? PrimaryImageUrl);
