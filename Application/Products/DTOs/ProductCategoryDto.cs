namespace Application.Products.DTOs;

/// <summary>
/// Represents one category assigned to a product.
/// </summary>
public sealed record ProductCategoryDto(
    Guid Id,
    string Name,
    string Slug,
    Guid? ParentCategoryId);
