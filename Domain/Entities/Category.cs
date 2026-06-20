using Domain.Common;

namespace Domain.Entities;

/// <summary>
/// Represents a product category.
/// </summary>
public class Category : AuditableEntity
{
    /// <summary>
    /// Gets or sets the localized category name.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the SEO-friendly and stable slug used in URLs.
    /// </summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets whether the category is visible in the storefront.
    /// </summary>
    public bool IsActive { get; set; } = true;

    /// <summary>
    /// Gets or sets the optional parent category identifier.
    /// </summary>
    public Guid? ParentCategoryId { get; set; }

    /// <summary>
    /// Gets or sets the optional parent category.
    /// </summary>
    public Category? ParentCategory { get; set; }

    /// <summary>
    /// Gets child categories.
    /// </summary>
    public List<Category> Children { get; set; } = [];

    /// <summary>
    /// Gets the products that belong to this category.
    /// </summary>
    public List<Product> Products { get; set; } = [];

    /// <summary>
    /// Gets the multi-category product links that reference this category.
    /// </summary>
    public List<ProductCategory> ProductCategories { get; set; } = [];
}
