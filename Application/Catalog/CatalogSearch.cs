using Application.Interfaces;
using Application.Products.DTOs;
using Application.Seo;
using Domain.Entities;
using Domain.Enums;
using Domain.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Catalog;

/// <summary>Public category landing and unique-product paginated search using the shared hierarchy policy.</summary>
public static class CatalogSearch
{
    public sealed record Query(string[]? Category = null, string? BaseCategory = null, string[]? Brand = null,
        string[]? Color = null, decimal? PriceMin = null, decimal? PriceMax = null, bool InStock = false,
        string Sort = "newest", int Page = 1, int PageSize = 12, string? Search = null) : IRequest<PageResult>;
    public sealed record PageResult(IReadOnlyList<CatalogQueries.CatalogProductDto> Products, int Total, int Page, int PageSize);

    public sealed class Handler(AppDbContext db, ISender mediator) : IRequestHandler<Query, PageResult>
    {
        public async Task<PageResult> Handle(Query request, CancellationToken ct)
        {
            var categories = await db.DisplayCategoriesAsync(ct);
            var tree = new CategoryHierarchy(categories);
            var query = db.Products.VisibleInUi(db).AsNoTracking().Where(x => x.Status == ProductStatus.Active);
            int? productCode = null;
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string text = request.Search.Trim().ToLowerInvariant();
                if (text.Length > 200) return new([], 0, 1, Math.Clamp(request.PageSize, 1, 48));
                productCode = ProductCodeSearch.Parse(text);
                query = query.Where(x => x.ProductCode == productCode || x.Title.ToLower().Contains(text) || x.Slug.ToLower().Contains(text));
            }
            HashSet<Guid> Resolve(IEnumerable<string> slugs) => tree.Descendants(categories.Where(x => slugs.Contains(x.Slug)).Select(x => x.Id), true);
            if (!string.IsNullOrWhiteSpace(request.BaseCategory))
            {
                var ids = Resolve([request.BaseCategory]);
                query = query.Where(x => (x.CategoryId.HasValue && ids.Contains(x.CategoryId.Value)) || x.Categories.Any(c => ids.Contains(c.CategoryId)));
            }
            if (request.Category?.Length > 0)
            {
                var ids = Resolve(request.Category);
                query = query.Where(x => (x.CategoryId.HasValue && ids.Contains(x.CategoryId.Value)) || x.Categories.Any(c => ids.Contains(c.CategoryId)));
            }
            if (request.Brand?.Length > 0) query = query.Where(x => x.Brand != null && (request.Brand.Contains(x.Brand.Slug) || request.Brand.Contains(x.Brand.Name)));
            if (request.Color?.Length > 0) query = query.Where(x => x.Colors.Any(c => request.Color.Contains(c.CatalogColor.Slug)));
            var policy = await Application.Shipping.ShippingPricing.ReadAsync(db, ct);
            decimal embedded = policy.IncludedInPrice ? policy.UnitAmount : 0;
            if (request.PriceMin.HasValue) query = query.Where(x => x.Price >= request.PriceMin.Value - embedded);
            if (request.PriceMax.HasValue) query = query.Where(x => x.Price <= request.PriceMax.Value - embedded);
            if (request.InStock) query = query.Where(x => x.StockQuantity > 0);
            int page = Math.Max(1, request.Page), size = Math.Clamp(request.PageSize, 1, 48);
            int total = await query.CountAsync(ct);
            page = Math.Min(page, Math.Max(1, (total + size - 1) / size));
            List<Guid> productIds;
            if (request.Sort is "priceAsc" or "priceDesc")
            {
                // SQLite cannot ORDER BY decimal. Keep exact decimal money, projecting only IDs/prices rather than casting to floating point.
                var prices = await query.Select(x => new { x.Id, x.Price, x.ProductCode }).ToListAsync(ct);
                var ranked = prices.OrderByDescending(x => x.ProductCode == productCode);
                var orderedPrices = request.Sort == "priceAsc" ? ranked.ThenBy(x => x.Price).ThenBy(x => x.Id)
                    : ranked.ThenByDescending(x => x.Price).ThenBy(x => x.Id);
                productIds = orderedPrices.Skip((page - 1) * size).Take(size).Select(x => x.Id).ToList();
            }
            else
            {
                var ranked = query.OrderByDescending(x => x.ProductCode == productCode);
                var ordered = request.Sort == "oldest" ? ranked.ThenBy(x => x.CreatedAtUtc).ThenBy(x => x.Id)
                    : ranked.ThenByDescending(x => x.CreatedAtUtc).ThenBy(x => x.Id);
                productIds = await ordered.Skip((page - 1) * size).Take(size).Select(x => x.Id).ToListAsync(ct);
            }
            if (productIds.Count == 0) return new([], total, page, size);
            var products = await mediator.Send(new CatalogQueries.Products.Query(Ids: productIds), ct);
            return new(productIds.Select(id => products.Single(x => x.Id == id)).ToList(), total, page, size);
        }
    }

    public sealed record CategoryQuery(string Slug) : IRequest<CategoryDetail?>;
    public sealed record CategoryLink(Guid Id, string Name, string Slug);
    public sealed record CategoryDetail(Guid Id, string Name, string Slug, string? DescriptionHtml, string? ImageUrl,
        SeoDto? Seo, IReadOnlyList<CategoryLink> Breadcrumbs, IReadOnlyList<CategoryLink> Children, string? Description = null);
    public sealed class CategoryHandler(AppDbContext db, IProductDescriptionService descriptions) : IRequestHandler<CategoryQuery, CategoryDetail?>
    {
        public async Task<CategoryDetail?> Handle(CategoryQuery request, CancellationToken ct)
        {
            var categories = await db.DisplayCategoriesAsync(ct);
            var category = categories.SingleOrDefault(x => x.Slug == request.Slug);
            if (category is null)
            {
                var id = await db.SlugHistories.AsNoTracking().Where(x => x.Kind == "category" && x.Slug == request.Slug).Select(x => (Guid?)x.EntityId).SingleOrDefaultAsync(ct);
                category = categories.SingleOrDefault(x => x.Id == id);
            }
            var tree = new CategoryHierarchy(categories);
            if (category is null || !tree.IsPublic(category.Id)) return null;
            return new(category.Id, category.Name, category.Slug, descriptions.Sanitize(category.Description), category.ImageUrl, SeoMapping.Map(category.Seo),
                tree.Path(category.Id).Select(x => new CategoryLink(x.Id, x.Name, x.Slug)).ToList(),
                categories.Where(x => x.ParentCategoryId == category.Id && tree.IsPublic(x.Id)).OrderBy(x => x.Name).Select(x => new CategoryLink(x.Id, x.Name, x.Slug)).ToList(),
                descriptions.Excerpt(category.Description, 160));
        }
    }
}
