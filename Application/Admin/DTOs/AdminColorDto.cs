namespace Application.Admin.DTOs;

/// <summary>
/// Represents a color row in the admin panel.
/// </summary>
public sealed record AdminColorDto(
    Guid Id,
    string Name,
    string Slug,
    string? HexCode,
    bool IsActive);
