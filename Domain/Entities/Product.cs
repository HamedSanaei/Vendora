using Domain.Common;
using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// Represents a product that can be listed and purchased.
/// </summary>
public class Product : AuditableEntity
{
    /// <summary>
    /// Gets or sets the product title.
    /// </summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the SEO-friendly and stable slug used in URLs.
    /// </summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the optional product description.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>
    /// Gets or sets the product price in the smallest currency unit used by the system.
    /// </summary>
    public decimal Price { get; set; }

    /// <summary>
    /// Gets or sets the available quantity.
    /// </summary>
    public int StockQuantity { get; set; }

    /// <summary>
    /// Gets or sets the publication state of the product.
    /// </summary>
    public ProductStatus Status { get; set; } = ProductStatus.Draft;

    /// <summary>
    /// Gets or sets the inventory availability state.
    /// </summary>
    public InventoryStatus InventoryStatus { get; set; } = InventoryStatus.Unknown;

    /// <summary>
    /// Gets or sets the category identifier.
    /// </summary>
    public Guid? CategoryId { get; set; }

    /// <summary>
    /// Gets or sets the category.
    /// </summary>
    public Category? Category { get; set; }

    /// <summary>
    /// Gets the product images.
    /// </summary>
    public List<ProductImage> Images { get; set; } = [];
}
