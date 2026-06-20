using Domain.Common;

namespace Domain.Entities;

/// <summary>
/// Represents a reusable storefront color option for product filtering.
/// </summary>
public class CatalogColor : AuditableEntity
{
    /// <summary>
    /// Gets or sets the display name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the SEO-friendly and filter-safe slug.
    /// </summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the optional hexadecimal color value.
    /// </summary>
    public string? HexCode { get; set; }

    /// <summary>
    /// Gets or sets whether this color can be selected.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Gets product links for this color.
    /// </summary>
    public List<ProductColor> Products { get; set; } = [];
}
