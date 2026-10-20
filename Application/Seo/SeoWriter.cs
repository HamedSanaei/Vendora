using Application.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Seo;

/// <summary>Preserves old-client metadata, reserves renamed URLs, and stores server-calculated assessments.</summary>
public static class SeoWriter
{
    /// <summary>Checks that a new slug is not reserved for a different entity.</summary>
    public static async Task<bool> ReservedAsync(AppDbContext db, string kind, string slug, Guid? id, CancellationToken ct)
    {
        // Legacy product IDs must never be reinterpreted as a different product's editable slug.
        if (kind == "product" && Guid.TryParse(slug, out var identifier) && identifier != id
            && await db.Products.AnyAsync(x => x.Id == identifier, ct)) return true;
        return await db.SlugHistories.AnyAsync(x => x.Kind == kind && x.Slug == slug && x.EntityId != id, ct);
    }

    /// <summary>Records an old slug in the caller's transaction; all aliases resolve directly to the current entity.</summary>
    public static async Task RememberAsync(AppDbContext db, string kind, Guid id, string oldSlug, string newSlug, CancellationToken ct)
    {
        if (oldSlug == newSlug) return;
        var history = await db.SlugHistories.SingleOrDefaultAsync(x => x.Kind == kind && x.Slug == oldSlug, ct);
        if (history is null) db.SlugHistories.Add(new SlugHistory { Kind = kind, EntityId = id, Slug = oldSlug });
    }

    /// <summary>Updates the optional owned value and calculates score using the same rules as draft previews.</summary>
    public static async Task<SeoMetadata> AssessAsync(AppDbContext db, SeoDraft draft, SeoMetadata? existing, IProductDescriptionService descriptions, CancellationToken ct)
    {
        var value = draft.Seo is not null ? SeoMapping.FromInput(draft.Seo) : existing ?? new SeoMetadata();
        var analysis = await SeoAnalyzer.AnalyzeAsync(db, draft with { Seo = SeoMapping.Map(value)!.Fields }, descriptions, ct);
        value.Score = analysis.Score; value.AnalysisVersion = analysis.Version;
        return value;
    }
}
