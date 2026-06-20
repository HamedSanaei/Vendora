namespace Application.Admin.DTOs;

/// <summary>
/// Represents a category row in the admin panel.
/// </summary>
public sealed record AdminCategoryDto(
    Guid Id,
    string Name,
    string Slug,
    Guid? ParentCategoryId,
    string? ParentCategoryName,
    int ProductCount,
    bool IsActive);
