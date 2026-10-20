using Domain.Common;

namespace Domain.Entities;

/// <summary>An ordered product specification referencing a global definition or a product-local name.</summary>
public sealed class ProductAttribute : EntityBase
{
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public Guid? CatalogAttributeId { get; set; }
    public CatalogAttribute? CatalogAttribute { get; set; }
    public string? CustomName { get; set; }
    public bool IsVisible { get; set; } = true;
    public int SortOrder { get; set; }
    public List<ProductAttributeValue> Values { get; set; } = [];
}

/// <summary>An ordered global term reference or a plain-text custom value. Global names are never copied.</summary>
public sealed class ProductAttributeValue : EntityBase
{
    public Guid ProductAttributeId { get; set; }
    public ProductAttribute ProductAttribute { get; set; } = null!;
    public Guid? CatalogAttributeTermId { get; set; }
    public CatalogAttributeTerm? CatalogAttributeTerm { get; set; }
    public string? CustomValue { get; set; }
    public int SortOrder { get; set; }
}
