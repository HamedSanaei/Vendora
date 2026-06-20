namespace Domain.Entities;

/// <summary>
/// Links a coupon to a category when it does not apply globally.
/// </summary>
public class CouponCategory
{
    /// <summary>Gets or sets the coupon identifier.</summary>
    public Guid CouponId { get; set; }

    /// <summary>Gets or sets the coupon.</summary>
    public Coupon Coupon { get; set; } = null!;

    /// <summary>Gets or sets the category identifier.</summary>
    public Guid CategoryId { get; set; }

    /// <summary>Gets or sets the category.</summary>
    public Category Category { get; set; } = null!;
}
