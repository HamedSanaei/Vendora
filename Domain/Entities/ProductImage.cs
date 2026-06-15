using Domain.Common;

namespace Domain.Entities;

/// <summary>
/// Represents a stored image for a product.
/// </summary>
public class ProductImage : AuditableEntity
{
    /// <summary>
    /// Gets or sets the owning product identifier.
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Gets or sets the owning product.
    /// </summary>
    public Product Product { get; set; } = null!;

    /// <summary>
    /// Gets or sets the image path or storage key.
    /// </summary>
    public string ImageUrl { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the alternative text used for accessibility and SEO.
    /// </summary>
    public string? AltText { get; set; }

    /// <summary>
    /// Gets or sets whether this image is the primary product image.
    /// </summary>
    public bool IsPrimary { get; set; }

    /// <summary>
    /// Gets or sets the display order among product images.
    /// </summary>
    public int SortOrder { get; set; }
}
