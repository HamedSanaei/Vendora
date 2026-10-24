using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Seo;

/// <summary>SEO configuration, preview and validated local redirect use cases.</summary>
public static class SeoQueries
{
    public sealed record SettingsQuery : IRequest<SeoSettings>;
    public sealed class SettingsHandler(AppDbContext db) : IRequestHandler<SettingsQuery, SeoSettings>
    {
        public async Task<SeoSettings> Handle(SettingsQuery request, CancellationToken ct)
            => await db.SeoSettings.AsNoTracking().SingleOrDefaultAsync(ct) ?? new SeoSettings();
    }

    public sealed record SaveSettings(SeoSettings Settings) : IRequest<string?>;
    public sealed class SaveSettingsHandler(AppDbContext db) : IRequestHandler<SaveSettings, string?>
    {
        public async Task<string?> Handle(SaveSettings request, CancellationToken ct)
        {
            var input = request.Settings;
            if (string.IsNullOrWhiteSpace(input.SiteName) || input.SiteName.Length > 150 || input.TitleTemplate.Length > 250
                || !input.TitleTemplate.Contains("{title}") || input.DefaultDescription?.Length > 500 || input.SocialProfiles?.Length > 2000
                || !SeoMapping.PublicUrl(input.SiteUrl) || input.SiteUrl.Length > 500
                || (input.LogoUrl?.Length > 0 && !SeoMapping.PublicUrl(input.LogoUrl) && !input.LogoUrl.StartsWith("/uploads/")))
                return "SEO: invalid site settings, URL, or title template.";
            var uri = new Uri(input.SiteUrl);
            if (uri.AbsolutePath != "/" || uri.Query.Length > 0 || uri.Fragment.Length > 0) return "SEO: site URL must be an origin without a path.";
            var value = await db.SeoSettings.SingleAsync(ct);
            value.SiteName = input.SiteName.Trim(); value.SiteUrl = uri.GetLeftPart(UriPartial.Authority);
            value.LogoUrl = input.LogoUrl; value.TitleTemplate = input.TitleTemplate.Trim(); value.DefaultDescription = input.DefaultDescription;
            value.SocialProfiles = input.SocialProfiles; value.IsIndexingEnabled = input.IsIndexingEnabled;
            await db.SaveChangesAsync(ct); return null;
        }
    }

    public sealed record AnalyzeQuery(SeoDraft Draft) : IRequest<SeoAnalysis>;
    public sealed class AnalyzeHandler(AppDbContext db, IProductDescriptionService descriptions) : IRequestHandler<AnalyzeQuery, SeoAnalysis>
    {
        public Task<SeoAnalysis> Handle(AnalyzeQuery request, CancellationToken ct)
            => SeoAnalyzer.AnalyzeAsync(db, request.Draft, descriptions, ct);
    }

    public sealed record RedirectDto(Guid Id, string SourcePath, string TargetPath, int StatusCode, bool IsActive);
    public sealed record RedirectListQuery : IRequest<IReadOnlyList<RedirectDto>>;
    public sealed class RedirectListHandler(AppDbContext db) : IRequestHandler<RedirectListQuery, IReadOnlyList<RedirectDto>>
    {
        public async Task<IReadOnlyList<RedirectDto>> Handle(RedirectListQuery request, CancellationToken ct)
            => await db.SeoRedirects.AsNoTracking().OrderBy(x => x.SourcePath)
                .Select(x => new RedirectDto(x.Id, x.SourcePath, x.TargetPath, x.StatusCode, x.IsActive)).ToListAsync(ct);
    }

    public sealed record SaveRedirect(Guid? Id, string SourcePath, string TargetPath, int StatusCode, bool IsActive) : IRequest<string?>;
    public sealed class SaveRedirectHandler(AppDbContext db) : IRequestHandler<SaveRedirect, string?>
    {
        public async Task<string?> Handle(SaveRedirect request, CancellationToken ct)
        {
            string source = request.SourcePath.Trim().TrimEnd('/');
            string target = request.TargetPath.Trim().TrimEnd('/');
            if (!LocalPublicPath(source) || !LocalPublicPath(target) || source == target || request.StatusCode is not (301 or 302))
                return "SEO: redirects require distinct local public paths and status 301 or 302.";
            var rows = await db.SeoRedirects.ToListAsync(ct);
            if (rows.Any(x => x.Id != request.Id && x.SourcePath == source)) return "SEO: source path already exists.";
            var edges = rows.Where(x => x.Id != request.Id && x.IsActive).ToDictionary(x => x.SourcePath, x => x.TargetPath);
            if (request.IsActive) edges[source] = target;
            foreach (string start in edges.Keys)
            {
                var seen = new HashSet<string>(); string current = start;
                while (true)
                {
                    if (!seen.Add(current)) return "SEO: redirect loop is not allowed.";
                    if (edges.TryGetValue(current, out string? next)) { current = next; continue; }
                    var canonical = await CanonicalPathAsync(db, current, ct);
                    if (canonical is not null && canonical != current) { current = canonical; continue; }
                    break;
                }
            }
            var row = request.Id.HasValue ? rows.SingleOrDefault(x => x.Id == request.Id) : new SeoRedirect();
            if (row is null) return "SEO: redirect was not found.";
            row.SourcePath = source; row.TargetPath = target; row.StatusCode = request.StatusCode; row.IsActive = request.IsActive;
            if (!request.Id.HasValue) db.SeoRedirects.Add(row);
            await db.SaveChangesAsync(ct); return null;
        }
    }

    public sealed record ResolveRedirectQuery(string Path) : IRequest<RedirectResult?>;
    public sealed record RedirectResult(string Location, int StatusCode);
    public sealed class ResolveRedirectHandler(AppDbContext db) : IRequestHandler<ResolveRedirectQuery, RedirectResult?>
    {
        public async Task<RedirectResult?> Handle(ResolveRedirectQuery request, CancellationToken ct)
        {
            string path = Uri.UnescapeDataString(request.Path);
            if (!LocalPublicPath(path)) return null;
            var rows = await db.SeoRedirects.AsNoTracking().Where(x => x.IsActive).ToListAsync(ct);
            string current = path.TrimEnd('/'); int? status = null; var seen = new HashSet<string>();
            while (seen.Add(current))
            {
                var row = rows.SingleOrDefault(x => x.SourcePath == current);
                if (row is not null) { status ??= row.StatusCode; current = row.TargetPath; continue; }
                var canonical = await CanonicalPathAsync(db, current, ct);
                if (canonical is not null && canonical != current) { status ??= 301; current = canonical; continue; }
                return status.HasValue ? new(current, status.Value) : null;
            }
            return null;
        }
    }

    /// <summary>Resolves legacy identifier links and slug histories directly to the latest active canonical URL.</summary>
    private static async Task<string?> CanonicalPathAsync(AppDbContext db, string path, CancellationToken ct)
    {
        string[] parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 3) return null;
        string identifier = parts[2];
        if (parts[1] is "product" or "product-details")
        {
            Guid.TryParse(identifier, out Guid id);
            var alias = await db.SlugHistories.AsNoTracking().Where(x => x.Kind == "product" && x.Slug == identifier).Select(x => (Guid?)x.EntityId).SingleOrDefaultAsync(ct);
            string? slug = await db.Products.VisibleInUi(db).AsNoTracking().Where(x => x.Status == Domain.Enums.ProductStatus.Active && (x.Slug == identifier || x.Id == id || x.Id == alias)).Select(x => x.Slug).SingleOrDefaultAsync(ct);
            return slug is null ? null : "/fa/product/" + slug;
        }
        if (parts[1] == "category")
        {
            var alias = await db.SlugHistories.AsNoTracking().Where(x => x.Kind == "category" && x.Slug == identifier).Select(x => (Guid?)x.EntityId).SingleOrDefaultAsync(ct);
            var categories = await db.DisplayCategoriesAsync(ct);
            var value = categories.SingleOrDefault(x => x.Slug == identifier || x.Id == alias);
            return value is null || !new Application.Catalog.CategoryHierarchy(categories).IsPublic(value.Id) ? null : "/fa/category/" + value.Slug;
        }
        return null;
    }


    /// <summary>Restricts redirect management to public Persian content, excluding open redirects and private flow interception.</summary>
    public static bool LocalPublicPath(string path)
    {
        if (path.Length > 600 || path.Contains('\\') || path.Contains('?') || path.Contains('#') || path.Contains('%') || path.Contains("..") || path.Any(char.IsControl)) return false;
        string[] parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return path.StartsWith("/fa/", StringComparison.Ordinal) && !path.Contains("//")
            && parts.Length >= 2 && parts[1] is "product" or "category" or "product-details" or "shop" or "about" or "contact" or "faq" or "policy" or "terms";
    }
}
