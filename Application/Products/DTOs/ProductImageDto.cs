namespace Application.Products.DTOs;

/// <summary>
/// Represents a product image in read models.
/// </summary>
public sealed record ProductImageDto(
    Guid Id,
    string ImageUrl,
    string? AltText,
    bool IsPrimary,
    int SortOrder);
