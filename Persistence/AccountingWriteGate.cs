using Domain.Accounting;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Persistence;

public partial class AppDbContext
{
    private Guid? _accountingGateTransactionId;

    /// <summary>Serializes stock/cutover writes across processes before reading authoritative quantities.</summary>
    public async Task AcquireAccountingWriteGateAsync(CancellationToken ct)
    {
        var transaction = Database.CurrentTransaction ?? throw new InvalidOperationException("A database transaction is required.");
        if (_accountingGateTransactionId == transaction.TransactionId) return;
        var tracked = ChangeTracker.Entries<AccountingState>().SingleOrDefault(x => x.Entity.Id == 1);
        if (tracked is not null && tracked.State != EntityState.Unchanged)
            throw new InvalidOperationException("Acquire the gate before modifying accounting state.");
        int rows = await AccountingStates.Where(x => x.Id == 1).ExecuteUpdateAsync(s => s.SetProperty(x => x.Version, x => x.Version + 1), ct);
        if (rows != 1) throw new InvalidOperationException("Accounting schema is not ready.");
        if (tracked is not null) await tracked.ReloadAsync(ct);
        _accountingGateTransactionId = transaction.TransactionId;
    }

    /// <summary>Wraps legacy product/seed stock writers in the same gate, including before operational cutover.</summary>
    private async Task<IDbContextTransaction?> StockWriteBoundaryAsync(CancellationToken ct)
    {
        if (!HasProductStockWrites()) return null;
        var owned = Database.CurrentTransaction is null ? await Database.BeginTransactionAsync(ct) : null;
        try { await AcquireAccountingWriteGateAsync(ct); return owned; }
        catch { if (owned is not null) await owned.DisposeAsync(); throw; }
    }

    /// <summary>Provides the synchronous seed/import equivalent without bypassing the write gate.</summary>
    private IDbContextTransaction? StockWriteBoundary()
    {
        if (!HasProductStockWrites()) return null;
        var owned = Database.CurrentTransaction is null ? Database.BeginTransaction() : null;
        try
        {
            var transaction = Database.CurrentTransaction!;
            if (_accountingGateTransactionId != transaction.TransactionId)
            {
                var tracked = ChangeTracker.Entries<AccountingState>().SingleOrDefault(x => x.Entity.Id == 1);
                if (tracked is not null && tracked.State != EntityState.Unchanged) throw new InvalidOperationException("Acquire the gate before modifying accounting state.");
                int rows = AccountingStates.Where(x => x.Id == 1).ExecuteUpdate(s => s.SetProperty(x => x.Version, x => x.Version + 1));
                if (rows != 1) throw new InvalidOperationException("Accounting schema is not ready.");
                tracked?.Reload(); _accountingGateTransactionId = transaction.TransactionId;
            }
            return owned;
        }
        catch { owned?.Dispose(); throw; }
    }

    /// <summary>Detects actual quantity edits; price/content edits do not acquire a stock lock.</summary>
    private bool HasProductStockWrites() => ChangeTracker.Entries<Product>().Any(x =>
        (x.State == EntityState.Added && x.Entity.StockQuantity != 0) ||
        (x.State == EntityState.Modified && x.Property(p => p.StockQuantity).IsModified));
}
