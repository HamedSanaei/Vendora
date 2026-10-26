using Application.Products.DTOs;
using Application.Interfaces;
using Application.Pricing;
using Application.Seo;
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
        IReadOnlyList<CatalogColorDto> Colors,
        string? DescriptionHtml = null,
        ProductPriceFreshnessDto? PriceFreshness = null,
        IReadOnlyList<ProductAttributeDto>? Attributes = null,
        SeoDto? Seo = null,
        IReadOnlyList<CatalogSearch.CategoryLink>? Breadcrumbs = null,
        double Rating = 0, int RatingCount = 0, int ReviewCount = 0, int ProductCode = 0, decimal BasePrice = 0, decimal EmbeddedShippingUnitAmount = 0, long ShippingPolicyVersion = 1, bool FreeShipping = false);

    /// <summary>Represents a recursive category node.</summary>
    public sealed record CatalogCategoryDto(Guid Id, string Name, string Slug, Guid? ParentCategoryId, IReadOnlyList<CatalogCategoryDto> Children);

    /// <summary>Represents a storefront brand option.</summary>
    public sealed record CatalogBrandDto(Guid Id, string Name, string Slug, string? LogoUrl);

    /// <summary>Lists active catalog products.</summary>
    public static class Products
    {
        /// <summary>Represents a product list query.</summary>
        public sealed record Query(string? Identifier = null, IReadOnlyList<Guid>? Ids = null) : IRequest<IReadOnlyList<CatalogProductDto>>;

        /// <summary>Handles catalog product list queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<CatalogProductDto>>
        {
            private readonly AppDbContext _dbContext;
            private readonly IProductDescriptionService _descriptions;
            private readonly TimeProvider _time;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext, IProductDescriptionService descriptions, TimeProvider time)
            {
                _dbContext = dbContext;
                _descriptions = descriptions;
                _time = time;
            }

            /// <inheritdoc />
            public async Task<IReadOnlyList<CatalogProductDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var query = _dbContext.Products.VisibleInUi(_dbContext)
                    .AsNoTracking()
                    .Include(product => product.Category)
                    .Include(product => product.Categories)
                    .ThenInclude(productCategory => productCategory.Category)
                    .Include(product => product.Brand)
                    .Include(product => product.Images)
                    .Include(product => product.Colors)
                    .ThenInclude(productColor => productColor.CatalogColor)
                    .AsSplitQuery()
                    .Where(product => product.Status == ProductStatus.Active);
                if (request.Identifier is not null)
                {
                    query = query.Include(product => product.Attributes.Where(attribute => attribute.IsVisible)).ThenInclude(attribute => attribute.CatalogAttribute)
                        .Include(product => product.Attributes.Where(attribute => attribute.IsVisible)).ThenInclude(attribute => attribute.Values).ThenInclude(value => value.CatalogAttributeTerm);
                    string identifier = request.Identifier;
                    bool isId = Guid.TryParse(identifier, out Guid productId);
                    var alias = await _dbContext.SlugHistories.AsNoTracking().Where(x => x.Kind == "product" && x.Slug == identifier).Select(x => (Guid?)x.EntityId).SingleOrDefaultAsync(cancellationToken);
                    query = query.Where(product => (isId && product.Id == productId) || product.Slug == identifier || product.Id == alias);
                }
                if (request.Ids is not null) query = query.Where(product => request.Ids.Contains(product.Id));
                var products = await query
                    .OrderByDescending(product => product.CreatedAtUtc)
                    .ToListAsync(cancellationToken);

                // One local database read for the entire result; never one exchange request per product or user.
                var rate = await _dbContext.UsdtExchangeRates.AsNoTracking().SingleOrDefaultAsync(cancellationToken);
                var policy = await Application.Shipping.ShippingPricing.ReadAsync(_dbContext, cancellationToken);
                var now = _time.GetUtcNow().UtcDateTime;
                var categoryGraph = request.Identifier is null ? [] : await _dbContext.DisplayCategoriesAsync(cancellationToken);
                var hierarchy = new CategoryHierarchy(categoryGraph);
                var discussions = await Application.Discussions.DiscussionQueries.Summaries(_dbContext, products.Select(p => p.Id).ToList(), cancellationToken);

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
                        _descriptions.Excerpt(product.Description),
                        policy.SellingPrice(product.Price),
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
                            .ToList(),
                        request.Identifier is null ? null : _descriptions.Sanitize(product.Description),
                        ProductPriceFreshness.Verify(product, rate, now),
                        request.Identifier is null ? null : Application.Products.ProductAttributeWriter.Map(product.Attributes, publicOnly: true),
                        SeoMapping.Map(product.Seo),
                        request.Identifier is null ? null : hierarchy.Path(product.CategoryId ?? product.Categories.FirstOrDefault()?.CategoryId ?? Guid.Empty)
                            .Where(x => hierarchy.IsPublic(x.Id)).Select(x => new CatalogSearch.CategoryLink(x.Id, x.Name, x.Slug)).ToList(),
                        discussions.GetValueOrDefault(product.Id)?.Rating ?? 0,
                        discussions.GetValueOrDefault(product.Id)?.RatingCount ?? 0,
                        discussions.GetValueOrDefault(product.Id)?.ReviewCount ?? 0,
                        product.ProductCode, product.Price, policy.IncludedInPrice ? policy.UnitAmount : 0, policy.Version, policy.IncludedInPrice);
                }).ToList();
            }

            private static Guid? ResolvePrimaryCategoryId(Domain.Entities.Product product)
            {
                return product.CategoryId ?? product.Categories.FirstOrDefault()?.CategoryId;
            }

            private static string? ResolvePrimaryCategoryName(Domain.Entities.Product product)
            {
                return product.Category?.Name ?? product.Categories.FirstOrDefault()?.Category?.Name;
            }

            private static string? ResolvePrimaryCategorySlug(Domain.Entities.Product product)
            {
                return product.Category?.Slug ?? product.Categories.FirstOrDefault()?.Category?.Slug;
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
                var categories = await _dbContext.DisplayCategoriesAsync(cancellationToken);
                var hierarchy = new CategoryHierarchy(categories);
                return BuildTree(categories.Where(x => hierarchy.IsPublic(x.Id)).ToList(), null);
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
                return await _dbContext.Brands.VisibleInUi(_dbContext)
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
                return await _dbContext.CatalogColors.VisibleInUi(_dbContext)
                    .AsNoTracking()
                    .Where(color => color.IsActive)
                    .OrderBy(color => color.Name)
                    .Select(color => new CatalogColorDto(color.Id, color.Name, color.Slug, color.HexCode))
                    .ToListAsync(cancellationToken);
            }
        }
    }
}
