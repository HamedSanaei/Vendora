using Domain.Common;

namespace Domain.Entities;

/// <summary>
/// Represents a percentage discount coupon managed by admins.
/// </summary>
public class Coupon : AuditableEntity
{
    /// <summary>Gets or sets the admin-facing title.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Gets or sets the unique coupon code.</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>Gets or sets the percentage discount value.</summary>
    public decimal DiscountPercent { get; set; }

    /// <summary>Gets or sets the optional maximum discount amount in Toman.</summary>
    public decimal? MaxDiscountAmount { get; set; }

    /// <summary>Gets or sets when the coupon expires.</summary>
    public DateTime ExpiresAtUtc { get; set; }

    /// <summary>Gets or sets whether the coupon is active.</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>Gets or sets whether the coupon applies to every category.</summary>
    public bool AppliesToAllCategories { get; set; } = true;

    /// <summary>Gets the category restrictions for this coupon.</summary>
    public List<CouponCategory> Categories { get; set; } = [];
}
