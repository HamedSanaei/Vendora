namespace Application.Products.DTOs;

/// <summary>
/// Represents a category option used by admin product forms.
/// </summary>
public sealed record AdminCategoryDto(Guid Id, string Name, string Slug, Guid? ParentCategoryId);
