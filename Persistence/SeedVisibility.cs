using Domain.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Persistence;

/// <summary>Presentation-only seed visibility; internal accounting, authentication and immutable snapshots remain unfiltered.</summary>
public static class SeedVisibility
{
    /// <summary>Filters known seed IDs using the current persisted switch in the same SQL query, without a stale process cache.</summary>
    public static IQueryable<T> VisibleInUi<T>(this IQueryable<T> query, AppDbContext db) where T : EntityBase
    {
        string kind = typeof(T).Name;
        return query.Where(entity => !db.SeoSettings.Any(settings => settings.HideSeedData)
            || !db.SeedRecords.Any(seed => seed.EntityType == kind && seed.EntityId == entity.Id));
    }

    /// <summary>Loads detached display categories, promoting real children of hidden seed parents without changing stored relationships.</summary>
    public static async Task<List<Category>> DisplayCategoriesAsync(this AppDbContext db, CancellationToken ct)
    {
        var categories = await db.Categories.VisibleInUi(db).AsNoTracking().ToListAsync(ct);
        var visibleIds = categories.Select(x => x.Id).ToHashSet();
        var missingParents = categories.Where(x => x.ParentCategoryId.HasValue && !visibleIds.Contains(x.ParentCategoryId.Value))
            .Select(x => x.ParentCategoryId!.Value).Distinct().ToList();
        if (missingParents.Count == 0) return categories;
        var hiddenParents = await db.SeedRecords.Where(x => x.EntityType == nameof(Category) && missingParents.Contains(x.EntityId)
            && db.SeoSettings.Any(settings => settings.HideSeedData)).Select(x => x.EntityId).ToListAsync(ct);
        foreach (var category in categories.Where(x => x.ParentCategoryId.HasValue && hiddenParents.Contains(x.ParentCategoryId.Value)))
            category.ParentCategoryId = null;
        return categories;
    }

    /// <summary>Records provenance only for newly inserted seed roots; pre-existing user-created records are never reclassified.</summary>
    public static async Task SaveSeedChangesAsync(AppDbContext db, CancellationToken ct)
    {
        var kinds = new HashSet<string> { nameof(Product), nameof(Category), nameof(Brand), nameof(CatalogColor),
            nameof(Coupon), nameof(UserAccount), nameof(Order), nameof(PaymentTransaction), nameof(Cart) };
        var added = db.ChangeTracker.Entries<EntityBase>().Where(e => e.State == EntityState.Added && kinds.Contains(e.Metadata.ClrType.Name))
            .Select(e => new SeedRecord { EntityType = e.Metadata.ClrType.Name, EntityId = e.Entity.Id }).ToList();
        foreach (var record in added)
            if (!db.SeedRecords.Local.Any(x => x.EntityType == record.EntityType && x.EntityId == record.EntityId)) db.SeedRecords.Add(record);
        await db.SaveChangesAsync(ct);
    }
}
