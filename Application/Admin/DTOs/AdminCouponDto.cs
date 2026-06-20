namespace Application.Admin.DTOs;

/// <summary>
/// Represents a coupon row in the admin panel.
/// </summary>
public sealed record AdminCouponDto(
    Guid Id,
    string Title,
    string Code,
    decimal DiscountPercent,
    decimal? MaxDiscountAmount,
    DateTime ExpiresAtUtc,
    bool IsActive,
    bool AppliesToAllCategories,
    IReadOnlyList<Guid> CategoryIds,
    IReadOnlyList<string> CategoryNames);
