using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Persistence.Admin;

/// <summary>
/// EF Core implementation of admin management persistence operations.
/// </summary>
public sealed class AdminRepository : IAdminRepository
{
    private readonly AppDbContext _dbContext;

    /// <summary>
    /// Creates an admin repository.
    /// </summary>
    /// <param name="dbContext">The EF Core database context.</param>
    public AdminRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Category>> GetCategoriesAsync(bool includeInactive, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Categories
            .AsNoTracking()
            .Include(category => category.ParentCategory)
            .Include(category => category.Products)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(category => category.IsActive);
        }

        return await query.OrderBy(category => category.Name).ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<Category?> GetCategoryAsync(Guid id, bool trackChanges, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Categories
            .Include(category => category.ParentCategory)
            .Where(category => category.Id == id);
        if (!trackChanges)
        {
            query = query.AsNoTracking();
        }

        return query.SingleOrDefaultAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<bool> CategorySlugExistsAsync(string slug, Guid? ignoredCategoryId = null, CancellationToken cancellationToken = default)
    {
        return _dbContext.Categories.AnyAsync(
            category => category.Slug == slug && (!ignoredCategoryId.HasValue || category.Id != ignoredCategoryId.Value),
            cancellationToken);
    }

    /// <inheritdoc />
    public async Task<bool> IsDescendantCategoryAsync(Guid categoryId, Guid parentCandidateId, CancellationToken cancellationToken = default)
    {
        Guid? currentId = parentCandidateId;
        while (currentId.HasValue)
        {
            if (currentId.Value == categoryId)
            {
                return true;
            }

            currentId = await _dbContext.Categories
                .AsNoTracking()
                .Where(category => category.Id == currentId.Value)
                .Select(category => category.ParentCategoryId)
                .SingleOrDefaultAsync(cancellationToken);
        }

        return false;
    }

    /// <inheritdoc />
    public async Task AddCategoryAsync(Category category, CancellationToken cancellationToken = default)
    {
        await _dbContext.Categories.AddAsync(category, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Brand>> GetBrandsAsync(bool includeInactive, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Brands.AsNoTracking().AsQueryable();
        if (!includeInactive)
        {
            query = query.Where(brand => brand.IsActive);
        }

        return await query.OrderBy(brand => brand.Name).ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<Brand?> GetBrandAsync(Guid id, bool trackChanges, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Brands.Where(brand => brand.Id == id);
        if (!trackChanges)
        {
            query = query.AsNoTracking();
        }

        return query.SingleOrDefaultAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<bool> BrandSlugExistsAsync(string slug, Guid? ignoredBrandId = null, CancellationToken cancellationToken = default)
    {
        return _dbContext.Brands.AnyAsync(
            brand => brand.Slug == slug && (!ignoredBrandId.HasValue || brand.Id != ignoredBrandId.Value),
            cancellationToken);
    }

    /// <inheritdoc />
    public async Task AddBrandAsync(Brand brand, CancellationToken cancellationToken = default)
    {
        await _dbContext.Brands.AddAsync(brand, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Coupon>> GetCouponsAsync(bool includeInactive, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Coupons
            .AsNoTracking()
            .Include(coupon => coupon.Categories)
            .ThenInclude(couponCategory => couponCategory.Category)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(coupon => coupon.IsActive);
        }

        return await query.OrderBy(coupon => coupon.Code).ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<Coupon?> GetCouponAsync(Guid id, bool trackChanges, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Coupons
            .Include(coupon => coupon.Categories)
            .ThenInclude(couponCategory => couponCategory.Category)
            .Where(coupon => coupon.Id == id);

        if (!trackChanges)
        {
            query = query.AsNoTracking();
        }

        return query.SingleOrDefaultAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<bool> CouponCodeExistsAsync(string code, Guid? ignoredCouponId = null, CancellationToken cancellationToken = default)
    {
        return _dbContext.Coupons.AnyAsync(
            coupon => coupon.Code == code && (!ignoredCouponId.HasValue || coupon.Id != ignoredCouponId.Value),
            cancellationToken);
    }

    /// <inheritdoc />
    public async Task<bool> CategoriesExistAsync(IReadOnlyCollection<Guid> categoryIds, CancellationToken cancellationToken = default)
    {
        if (categoryIds.Count == 0)
        {
            return true;
        }

        int count = await _dbContext.Categories
            .Where(category => categoryIds.Contains(category.Id))
            .CountAsync(cancellationToken);

        return count == categoryIds.Distinct().Count();
    }

    /// <inheritdoc />
    public async Task AddCouponAsync(Coupon coupon, CancellationToken cancellationToken = default)
    {
        await _dbContext.Coupons.AddAsync(coupon, cancellationToken);
    }

    /// <inheritdoc />
    public void RemoveCouponCategories(Coupon coupon)
    {
        _dbContext.CouponCategories.RemoveRange(coupon.Categories);
        coupon.Categories.Clear();
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<UserAccount>> GetUsersAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.UserAccounts
            .AsNoTracking()
            .OrderBy(user => user.FullName)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<UserAccount?> GetUserAsync(Guid id, bool trackChanges, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.UserAccounts.Where(user => user.Id == id);
        if (!trackChanges)
        {
            query = query.AsNoTracking();
        }

        return query.SingleOrDefaultAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<bool> UserEmailExistsAsync(string email, Guid? ignoredUserId = null, CancellationToken cancellationToken = default)
    {
        return _dbContext.UserAccounts.AnyAsync(
            user => user.Email == email && (!ignoredUserId.HasValue || user.Id != ignoredUserId.Value),
            cancellationToken);
    }
}
