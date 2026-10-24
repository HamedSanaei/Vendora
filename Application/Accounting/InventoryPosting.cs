using Domain.Accounting;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

/// <summary>Single stock-write path for posting, reservations, releases and authorized adjustments.</summary>
public sealed class InventoryPosting(AppDbContext db, TimeProvider time)
{
    /// <summary>Loads or creates a zero balance; legacy nonzero stock must be resolved by audited setup.</summary>
    public async Task<InventoryBalance> BalanceAsync(Guid productId, CancellationToken ct)
    {
        var balance = db.InventoryBalances.Local.FirstOrDefault(x => x.ProductId == productId)
            ?? await db.InventoryBalances.SingleOrDefaultAsync(x => x.ProductId == productId, ct);
        if (balance is not null) return balance;
        var product = await db.Products.SingleOrDefaultAsync(x => x.Id == productId, ct) ?? throw new AccountingException("PRODUCT_NOT_FOUND", 404);
        if (product.StockQuantity != 0) throw new AccountingException("UNRECONCILED_LEGACY_STOCK");
        balance = new InventoryBalance(productId); db.InventoryBalances.Add(balance); return balance;
    }

    /// <summary>Adds immutable source evidence and updates the storefront's available-stock projection.</summary>
    public async Task<Guid> RecordAsync(InventoryBalance balance, string source, StockMovementKind kind, int quantity, int reserved,
        decimal value, Guid actor, string reason, CancellationToken ct, Guid? reverses = null)
    {
        if (db.Database.CurrentTransaction is null) throw new InvalidOperationException("Stock changes require a transaction.");
        var movement = new StockMovement { ProductId = balance.ProductId, SourceKey = source, Kind = kind,
            QuantityDelta = quantity, ReservedDelta = reserved, ValueDelta = value, ActorId = actor,
            Reason = reason, PostedAtUtc = time.GetUtcNow().UtcDateTime, ReversesMovementId = reverses };
        db.StockMovements.Add(movement);
        var product = db.Products.Local.FirstOrDefault(x => x.Id == balance.ProductId)
            ?? await db.Products.SingleAsync(x => x.Id == balance.ProductId, ct);
        db.ProjectInventory(product, balance);
        return movement.Id;
    }
}
