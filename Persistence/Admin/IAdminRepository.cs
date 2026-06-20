using Domain.Entities;

namespace Persistence.Admin;

/// <summary>
/// Provides persistence operations for admin management screens.
/// </summary>
public interface IAdminRepository
{
    /// <summary>Returns categories with product counts.</summary>
    Task<IReadOnlyList<Category>> GetCategoriesAsync(bool includeInactive, CancellationToken cancellationToken = default);

    /// <summary>Returns one category.</summary>
    Task<Category?> GetCategoryAsync(Guid id, bool trackChanges, CancellationToken cancellationToken = default);

    /// <summary>Returns whether a category slug is already used.</summary>
    Task<bool> CategorySlugExistsAsync(string slug, Guid? ignoredCategoryId = null, CancellationToken cancellationToken = default);

    /// <summary>Returns whether the parent candidate is a descendant of the category.</summary>
    Task<bool> IsDescendantCategoryAsync(Guid categoryId, Guid parentCandidateId, CancellationToken cancellationToken = default);

    /// <summary>Adds a category.</summary>
    Task AddCategoryAsync(Category category, CancellationToken cancellationToken = default);

    /// <summary>Returns brands.</summary>
    Task<IReadOnlyList<Brand>> GetBrandsAsync(bool includeInactive, CancellationToken cancellationToken = default);

    /// <summary>Returns one brand.</summary>
    Task<Brand?> GetBrandAsync(Guid id, bool trackChanges, CancellationToken cancellationToken = default);

    /// <summary>Returns whether a brand slug is already used.</summary>
    Task<bool> BrandSlugExistsAsync(string slug, Guid? ignoredBrandId = null, CancellationToken cancellationToken = default);

    /// <summary>Adds a brand.</summary>
    Task AddBrandAsync(Brand brand, CancellationToken cancellationToken = default);

    /// <summary>Returns coupons with category restrictions.</summary>
    Task<IReadOnlyList<Coupon>> GetCouponsAsync(bool includeInactive, CancellationToken cancellationToken = default);

    /// <summary>Returns one coupon.</summary>
    Task<Coupon?> GetCouponAsync(Guid id, bool trackChanges, CancellationToken cancellationToken = default);

    /// <summary>Returns whether a coupon code is already used.</summary>
    Task<bool> CouponCodeExistsAsync(string code, Guid? ignoredCouponId = null, CancellationToken cancellationToken = default);

    /// <summary>Returns whether every category id exists.</summary>
    Task<bool> CategoriesExistAsync(IReadOnlyCollection<Guid> categoryIds, CancellationToken cancellationToken = default);

    /// <summary>Adds a coupon.</summary>
    Task AddCouponAsync(Coupon coupon, CancellationToken cancellationToken = default);

    /// <summary>Clears coupon category restrictions.</summary>
    void RemoveCouponCategories(Coupon coupon);

    /// <summary>Returns users.</summary>
    Task<IReadOnlyList<UserAccount>> GetUsersAsync(CancellationToken cancellationToken = default);

    /// <summary>Returns one user.</summary>
    Task<UserAccount?> GetUserAsync(Guid id, bool trackChanges, CancellationToken cancellationToken = default);

    /// <summary>Returns whether an email is already used by another account.</summary>
    Task<bool> UserEmailExistsAsync(string email, Guid? ignoredUserId = null, CancellationToken cancellationToken = default);
}
