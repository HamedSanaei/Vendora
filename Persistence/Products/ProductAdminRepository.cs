using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Persistence.Products;

/// <summary>
/// EF Core implementation of admin product persistence operations.
/// </summary>
public sealed class ProductAdminRepository : IProductAdminRepository
{
    private readonly AppDbContext _dbContext;

    /// <summary>
    /// Creates an admin product repository.
    /// </summary>
    /// <param name="dbContext">The EF Core database context.</param>
    public ProductAdminRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Product>> GetProductsAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.Products
            .AsNoTracking()
            .Include(product => product.Category)
            .Include(product => product.Categories)
            .ThenInclude(productCategory => productCategory.Category)
            .Include(product => product.Brand)
            .Include(product => product.Images)
            .Include(product => product.Colors)
            .ThenInclude(productColor => productColor.CatalogColor)
            .OrderBy(product => product.Title)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<Product?> GetProductAsync(Guid id, bool trackChanges, CancellationToken cancellationToken = default)
    {
        var query = _dbContext.Products
            .Include(product => product.Category)
            .Include(product => product.Categories)
            .ThenInclude(productCategory => productCategory.Category)
            .Include(product => product.Brand)
            .Include(product => product.Images)
            .Include(product => product.Colors)
            .ThenInclude(productColor => productColor.CatalogColor)
            .Where(product => product.Id == id);

        if (!trackChanges)
        {
            query = query.AsNoTracking();
        }

        return query.SingleOrDefaultAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Category>> GetCategoriesAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.Categories
            .AsNoTracking()
            .Where(category => category.IsActive)
            .OrderBy(category => category.Name)
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<bool> SlugExistsAsync(string slug, Guid? ignoredProductId = null, CancellationToken cancellationToken = default)
    {
        return _dbContext.Products.AnyAsync(
            product => product.Slug == slug && (!ignoredProductId.HasValue || product.Id != ignoredProductId.Value),
            cancellationToken);
    }

    /// <inheritdoc />
    public Task<bool> CategoryExistsAsync(Guid categoryId, CancellationToken cancellationToken = default)
    {
        return _dbContext.Categories.AnyAsync(category => category.Id == categoryId, cancellationToken);
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
    public Task<bool> BrandExistsAsync(Guid brandId, CancellationToken cancellationToken = default)
    {
        return _dbContext.Brands.AnyAsync(brand => brand.Id == brandId, cancellationToken);
    }

    /// <inheritdoc />
    public async Task<bool> ColorsExistAsync(IReadOnlyCollection<Guid> colorIds, CancellationToken cancellationToken = default)
    {
        if (colorIds.Count == 0)
        {
            return true;
        }

        int count = await _dbContext.CatalogColors
            .Where(color => colorIds.Contains(color.Id))
            .CountAsync(cancellationToken);

        return count == colorIds.Distinct().Count();
    }

    /// <inheritdoc />
    public async Task AddAsync(Product product, CancellationToken cancellationToken = default)
    {
        await _dbContext.Products.AddAsync(product, cancellationToken);
    }

    /// <inheritdoc />
    public void RemoveImages(Product product)
    {
        _dbContext.ProductImages.RemoveRange(product.Images);
        product.Images.Clear();
    }

    /// <inheritdoc />
    public void RemoveImages(Product product, IReadOnlyCollection<Guid> imageIds)
    {
        if (imageIds.Count == 0)
        {
            return;
        }

        var images = product.Images.Where(image => imageIds.Contains(image.Id)).ToList();
        _dbContext.ProductImages.RemoveRange(images);

        foreach (var image in images)
        {
            product.Images.Remove(image);
        }
    }

    /// <inheritdoc />
    public void ReplaceColors(Product product, IReadOnlyCollection<Guid> colorIds)
    {
        _dbContext.ProductColors.RemoveRange(product.Colors);
        product.Colors.Clear();

        foreach (var colorId in colorIds.Distinct())
        {
            product.Colors.Add(new ProductColor
            {
                ProductId = product.Id,
                CatalogColorId = colorId
            });
        }
    }

    /// <inheritdoc />
    public void ReplaceCategories(Product product, IReadOnlyCollection<Guid> categoryIds)
    {
        _dbContext.ProductCategories.RemoveRange(product.Categories);
        product.Categories.Clear();

        foreach (var categoryId in categoryIds.Distinct())
        {
            product.Categories.Add(new ProductCategory
            {
                ProductId = product.Id,
                CategoryId = categoryId
            });
        }
    }
}
