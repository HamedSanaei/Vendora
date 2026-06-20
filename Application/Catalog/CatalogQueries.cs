using Application.Products.DTOs;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Catalog;

/// <summary>
/// Storefront catalog read models and queries.
/// </summary>
public static class CatalogQueries
{
    /// <summary>Represents a catalog product for the storefront.</summary>
    public sealed record CatalogProductDto(
        Guid Id,
        string Title,
        string Slug,
        string? Description,
        decimal Price,
        int StockQuantity,
        Guid? CategoryId,
        string? CategoryName,
        string? CategorySlug,
        Guid? BrandId,
        string? BrandName,
        string? BrandSlug,
        string? PrimaryImageUrl,
        IReadOnlyList<ProductImageDto> Images,
        IReadOnlyList<ProductCategoryDto> Categories,
        IReadOnlyList<CatalogColorDto> Colors);

    /// <summary>Represents a recursive category node.</summary>
    public sealed record CatalogCategoryDto(Guid Id, string Name, string Slug, Guid? ParentCategoryId, IReadOnlyList<CatalogCategoryDto> Children);

    /// <summary>Represents a storefront brand option.</summary>
    public sealed record CatalogBrandDto(Guid Id, string Name, string Slug, string? LogoUrl);

    /// <summary>Lists active catalog products.</summary>
    public static class Products
    {
        /// <summary>Represents a product list query.</summary>
        public sealed record Query : IRequest<IReadOnlyList<CatalogProductDto>>;

        /// <summary>Handles catalog product list queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<CatalogProductDto>>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<IReadOnlyList<CatalogProductDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var products = await _dbContext.Products
                    .AsNoTracking()
                    .Include(product => product.Category)
                    .Include(product => product.Categories)
                    .ThenInclude(productCategory => productCategory.Category)
                    .Include(product => product.Brand)
                    .Include(product => product.Images)
                    .Include(product => product.Colors)
                    .ThenInclude(productColor => productColor.CatalogColor)
                    .AsSplitQuery()
                    .Where(product => product.Status == ProductStatus.Active)
                    .OrderByDescending(product => product.CreatedAtUtc)
                    .ToListAsync(cancellationToken);

                return products.Select(product =>
                {
                    var images = product.Images
                        .OrderBy(image => image.SortOrder)
                        .Select(image => new ProductImageDto(image.Id, image.ImageUrl, image.AltText, image.IsPrimary, image.SortOrder))
                        .ToList();

                    return new CatalogProductDto(
                        product.Id,
                        product.Title,
                        product.Slug,
                        product.Description,
                        product.Price,
                        product.StockQuantity,
                        ResolvePrimaryCategoryId(product),
                        ResolvePrimaryCategoryName(product),
                        ResolvePrimaryCategorySlug(product),
                        product.BrandId,
                        product.Brand?.Name,
                        product.Brand?.Slug,
                        images.FirstOrDefault(image => image.IsPrimary)?.ImageUrl ?? images.FirstOrDefault()?.ImageUrl,
                        images,
                        product.Categories
                            .Where(productCategory => productCategory.Category is not null)
                            .OrderBy(productCategory => productCategory.Category.Name)
                            .Select(productCategory => new ProductCategoryDto(
                                productCategory.Category.Id,
                                productCategory.Category.Name,
                                productCategory.Category.Slug,
                                productCategory.Category.ParentCategoryId))
                            .ToList(),
                        product.Colors
                            .Select(color => color.CatalogColor)
                            .OrderBy(color => color.Name)
                            .Select(color => new CatalogColorDto(color.Id, color.Name, color.Slug, color.HexCode))
                            .ToList());
                }).ToList();
            }

            private static Guid? ResolvePrimaryCategoryId(Domain.Entities.Product product)
            {
                return product.Categories.FirstOrDefault()?.CategoryId ?? product.CategoryId;
            }

            private static string? ResolvePrimaryCategoryName(Domain.Entities.Product product)
            {
                return product.Categories.FirstOrDefault()?.Category?.Name ?? product.Category?.Name;
            }

            private static string? ResolvePrimaryCategorySlug(Domain.Entities.Product product)
            {
                return product.Categories.FirstOrDefault()?.Category?.Slug ?? product.Category?.Slug;
            }
        }
    }

    /// <summary>Lists active categories as a tree.</summary>
    public static class CategoriesTree
    {
        /// <summary>Represents a category-tree query.</summary>
        public sealed record Query : IRequest<IReadOnlyList<CatalogCategoryDto>>;

        /// <summary>Handles category-tree queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<CatalogCategoryDto>>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<IReadOnlyList<CatalogCategoryDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var categories = await _dbContext.Categories
                    .AsNoTracking()
                    .Where(category => category.IsActive)
                    .OrderBy(category => category.Name)
                    .ToListAsync(cancellationToken);

                return BuildTree(categories, null);
            }

            private static IReadOnlyList<CatalogCategoryDto> BuildTree(IReadOnlyList<Domain.Entities.Category> categories, Guid? parentId)
            {
                return categories
                    .Where(category => category.ParentCategoryId == parentId)
                    .OrderBy(category => category.Name)
                    .Select(category => new CatalogCategoryDto(
                        category.Id,
                        category.Name,
                        category.Slug,
                        category.ParentCategoryId,
                        BuildTree(categories, category.Id)))
                    .ToList();
            }
        }
    }

    /// <summary>Lists active brands.</summary>
    public static class Brands
    {
        /// <summary>Represents a brand list query.</summary>
        public sealed record Query : IRequest<IReadOnlyList<CatalogBrandDto>>;

        /// <summary>Handles brand list queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<CatalogBrandDto>>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<IReadOnlyList<CatalogBrandDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                return await _dbContext.Brands
                    .AsNoTracking()
                    .Where(brand => brand.IsActive)
                    .OrderBy(brand => brand.Name)
                    .Select(brand => new CatalogBrandDto(brand.Id, brand.Name, brand.Slug, brand.LogoUrl))
                    .ToListAsync(cancellationToken);
            }
        }
    }

    /// <summary>Lists active colors.</summary>
    public static class Colors
    {
        /// <summary>Represents a color list query.</summary>
        public sealed record Query : IRequest<IReadOnlyList<CatalogColorDto>>;

        /// <summary>Handles color list queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<CatalogColorDto>>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<IReadOnlyList<CatalogColorDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                return await _dbContext.CatalogColors
                    .AsNoTracking()
                    .Where(color => color.IsActive)
                    .OrderBy(color => color.Name)
                    .Select(color => new CatalogColorDto(color.Id, color.Name, color.Slug, color.HexCode))
                    .ToListAsync(cancellationToken);
            }
        }
    }
}
