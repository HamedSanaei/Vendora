using Domain.Common;
using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// Represents a product that can be listed and purchased.
/// </summary>
public class Product : AuditableEntity
{
    /// <summary>Maximum persisted article length, including formatting markup.</summary>
    public const int MaxDescriptionLength = 200_000;

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
    /// Gets or sets the product price in Toman.
    /// </summary>
    public decimal Price { get; set; }

    /// <summary>Optional dollar base price; null retains fixed Toman pricing.</summary>
    public decimal? UsdPrice { get; set; }

    /// <summary>Internal Toman/USDT rate that produced the persisted Toman unit price.</summary>
    public decimal? PriceExchangeRate { get; set; }

    /// <summary>Sets a fixed Toman price or materializes a dollar price using the internal rate.</summary>
    public void SetPricing(decimal tomanPrice, decimal? usdPrice, decimal? exchangeRate)
    {
        if (usdPrice.HasValue)
        {
            Price = Domain.Pricing.DollarPricing.ToToman(usdPrice.Value,
                exchangeRate ?? throw new InvalidOperationException("An internal exchange rate is required."));
            UsdPrice = usdPrice;
            PriceExchangeRate = exchangeRate;
        }
        else
        {
            if (tomanPrice <= 0) throw new ArgumentOutOfRangeException(nameof(tomanPrice));
            Price = tomanPrice;
            UsdPrice = null;
            PriceExchangeRate = null;
        }
    }

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
    /// Gets the multi-category links assigned to the product.
    /// </summary>
    public List<ProductCategory> Categories { get; set; } = [];

    /// <summary>
    /// Gets or sets the optional brand identifier.
    /// </summary>
    public Guid? BrandId { get; set; }

    /// <summary>
    /// Gets or sets the optional brand.
    /// </summary>
    public Brand? Brand { get; set; }

    /// <summary>
    /// Gets product color links.
    /// </summary>
    public List<ProductColor> Colors { get; set; } = [];

    /// <summary>
    /// Gets the product images.
    /// </summary>
    public List<ProductImage> Images { get; set; } = [];
}
