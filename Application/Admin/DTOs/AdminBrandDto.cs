namespace Application.Admin.DTOs;

/// <summary>
/// Represents a brand row in the admin panel.
/// </summary>
public sealed record AdminBrandDto(
    Guid Id,
    string Name,
    string Slug,
    string? LogoUrl,
    string? Email,
    string? Website,
    string? Description,
    string? Location,
    bool IsActive);
