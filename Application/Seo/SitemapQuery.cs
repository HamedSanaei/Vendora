using Application.Catalog;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Seo;

/// <summary>Only published, indexable Persian public content is eligible for sitemap discovery.</summary>
public sealed record SitemapQuery : IRequest<IReadOnlyList<SitemapEntry>>;
public sealed record SitemapEntry(string Path, DateTime? LastModified);
public sealed class SitemapHandler(AppDbContext db) : IRequestHandler<SitemapQuery, IReadOnlyList<SitemapEntry>>
{
    public async Task<IReadOnlyList<SitemapEntry>> Handle(SitemapQuery request, CancellationToken ct)
    {
        var settings = await db.SeoSettings.AsNoTracking().SingleOrDefaultAsync(ct);
        if (settings?.IsIndexingEnabled != true) return [];
        var products = await db.Products.VisibleInUi(db).AsNoTracking().Where(x => x.Status == ProductStatus.Active && (x.Seo == null || x.Seo.Index))
            .Select(x => new { x.Slug, Date = x.UpdatedAtUtc ?? x.CreatedAtUtc }).ToListAsync(ct);
        var categories = await db.DisplayCategoriesAsync(ct);
        var tree = new CategoryHierarchy(categories);
        return products.Select(x => new SitemapEntry("/fa/product/" + Uri.EscapeDataString(x.Slug), x.Date))
            .Concat(categories.Where(x => tree.IsPublic(x.Id) && x.Seo?.Index != false).Select(x => new SitemapEntry("/fa/category/" + Uri.EscapeDataString(x.Slug), x.UpdatedAtUtc ?? x.CreatedAtUtc)))
            .Concat(new[] { "/fa", "/fa/shop", "/fa/about", "/fa/contact", "/fa/faq" }.Select(x => new SitemapEntry(x, null))).ToList();
    }
}
