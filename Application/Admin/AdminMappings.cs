using Application.Admin.DTOs;
using Domain.Entities;

namespace Application.Admin;

/// <summary>
/// Maps admin domain entities to DTOs.
/// </summary>
public static class AdminMappings
{
    /// <summary>Maps a category to an admin DTO.</summary>
    public static AdminCategoryDto MapCategory(Category category)
    {
        return new AdminCategoryDto(
            category.Id,
            category.Name,
            category.Slug,
            category.ParentCategoryId,
            category.ParentCategory?.Name,
            category.Products.Count,
            category.IsActive);
    }

    /// <summary>Maps a brand to an admin DTO.</summary>
    public static AdminBrandDto MapBrand(Brand brand)
    {
        return new AdminBrandDto(
            brand.Id,
            brand.Name,
            brand.Slug,
            brand.LogoUrl,
            brand.Email,
            brand.Website,
            brand.Description,
            brand.Location,
            brand.IsActive);
    }

    /// <summary>Maps a coupon to an admin DTO.</summary>
    public static AdminCouponDto MapCoupon(Coupon coupon)
    {
        return new AdminCouponDto(
            coupon.Id,
            coupon.Title,
            coupon.Code,
            coupon.DiscountPercent,
            coupon.MaxDiscountAmount,
            coupon.ExpiresAtUtc,
            coupon.IsActive,
            coupon.AppliesToAllCategories,
            coupon.Categories.Select(category => category.CategoryId).ToList(),
            coupon.Categories.Select(category => category.Category.Name).ToList());
    }

    /// <summary>Maps a user account to an admin DTO.</summary>
    public static AdminUserDto MapUser(UserAccount user)
    {
        return new AdminUserDto(user.Id, user.FullName, user.Email, user.PhoneNumber, user.Role);
    }
}
