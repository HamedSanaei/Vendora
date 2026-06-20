namespace Domain.Entities;

/// <summary>
/// Links a product to one category in the multi-category catalog taxonomy.
/// </summary>
public class ProductCategory
{
    /// <summary>
    /// Gets or sets the product identifier.
    /// </summary>
    public Guid ProductId { get; set; }

    /// <summary>
    /// Gets or sets the product.
    /// </summary>
    public Product Product { get; set; } = null!;

    /// <summary>
    /// Gets or sets the category identifier.
    /// </summary>
    public Guid CategoryId { get; set; }

    /// <summary>
    /// Gets or sets the category.
    /// </summary>
    public Category Category { get; set; } = null!;
}
