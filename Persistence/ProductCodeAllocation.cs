using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Persistence;

public partial class AppDbContext
{
    /// <summary>Allocates a batch of public codes and persists products atomically, including seed/import inserts.</summary>
    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        var added = ProductsNeedingCodes();
        if (added.Count == 0)
        {
            ApplyAuditTimestamps();
            return await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }

        await using var transaction = Database.CurrentTransaction is null
            ? await Database.BeginTransactionAsync(cancellationToken) : null;
        try
        {
            // The first statement acquires the database write lock; never use MAX(ProductCode) + 1.
            int updated = await ProductCodeSequences.Where(x => x.Id == 1 && x.NextValue <= int.MaxValue - added.Count)
                .ExecuteUpdateAsync(set => set.SetProperty(x => x.NextValue, x => x.NextValue + added.Count), cancellationToken);
            if (updated != 1) throw new InvalidOperationException("Product code counter is missing or exhausted.");
            int next = await ProductCodeSequences.Where(x => x.Id == 1).Select(x => x.NextValue).SingleAsync(cancellationToken);
            AssignCodes(added, next - added.Count);
            ApplyAuditTimestamps();
            int result = await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
            if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            return result;
        }
        catch
        {
            AssignCodes(added, 0, reset: true);
            throw;
        }
    }

    /// <summary>Provides the same atomic numbering for synchronous seed and persistence callers.</summary>
    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        var added = ProductsNeedingCodes();
        if (added.Count == 0)
        {
            ApplyAuditTimestamps();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        using var transaction = Database.CurrentTransaction is null ? Database.BeginTransaction() : null;
        try
        {
            int updated = ProductCodeSequences.Where(x => x.Id == 1 && x.NextValue <= int.MaxValue - added.Count)
                .ExecuteUpdate(set => set.SetProperty(x => x.NextValue, x => x.NextValue + added.Count));
            if (updated != 1) throw new InvalidOperationException("Product code counter is missing or exhausted.");
            int next = ProductCodeSequences.Where(x => x.Id == 1).Select(x => x.NextValue).Single();
            AssignCodes(added, next - added.Count);
            ApplyAuditTimestamps();
            int result = base.SaveChanges(acceptAllChangesOnSuccess);
            transaction?.Commit();
            return result;
        }
        catch
        {
            AssignCodes(added, 0, reset: true);
            throw;
        }
    }

    /// <summary>Rejects changes to assigned codes and collects all new products for one locked allocation.</summary>
    private List<EntityEntry<Product>> ProductsNeedingCodes()
    {
        var entries = ChangeTracker.Entries<Product>().ToList();
        if (entries.Any(x => x.State == EntityState.Modified && x.Property(p => p.ProductCode).IsModified
            && x.Property(p => p.ProductCode).CurrentValue != x.Property(p => p.ProductCode).OriginalValue))
            throw new InvalidOperationException("An assigned product code cannot be changed.");
        return entries.Where(x => x.State == EntityState.Added).ToList();
    }

    /// <summary>Assigns the reserved range, or clears it if persistence failed so a retry cannot reuse a reservation.</summary>
    private static void AssignCodes(List<EntityEntry<Product>> entries, int first, bool reset = false)
    {
        for (int i = 0; i < entries.Count; i++) entries[i].Property(x => x.ProductCode).CurrentValue = reset ? 0 : first + i;
    }
}
