namespace Domain.Entities;

/// <summary>
/// Connects a product to a catalog color option.
/// </summary>
public class ProductColor
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
    /// Gets or sets the color identifier.
    /// </summary>
    public Guid CatalogColorId { get; set; }

    /// <summary>
    /// Gets or sets the color option.
    /// </summary>
    public CatalogColor CatalogColor { get; set; } = null!;
}
