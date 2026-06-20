namespace Application.Products.DTOs;

/// <summary>
/// Represents a storefront/admin color option.
/// </summary>
public sealed record CatalogColorDto(Guid Id, string Name, string Slug, string? HexCode);
