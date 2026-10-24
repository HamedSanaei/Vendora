using Domain.Accounting;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Persistence.Identity;

namespace Persistence;

public partial class AppDbContext
{
    private readonly Dictionary<Guid, int> _authorizedStockProjections = new();

    /// <summary>Projects available inventory into the legacy product field, never accepting a browser stock authority.</summary>
    public void ProjectInventory(Product product, InventoryBalance balance)
    {
        if (product.Id != balance.ProductId || Database.CurrentTransaction is null) throw new InvalidOperationException("Invalid stock projection.");
        product.StockQuantity = balance.Available;
        if (product.InventoryStatus != Domain.Enums.InventoryStatus.Discontinued)
            product.InventoryStatus = balance.Available == 0 ? Domain.Enums.InventoryStatus.OutOfStock
                : balance.Available <= 5 ? Domain.Enums.InventoryStatus.LowStock : Domain.Enums.InventoryStatus.InStock;
        _authorizedStockProjections[product.Id] = balance.Available;
    }
    public DbSet<InventoryBalance> InventoryBalances => Set<InventoryBalance>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<StockReservation> StockReservations => Set<StockReservation>();
    public DbSet<FinancialDocument> FinancialDocuments => Set<FinancialDocument>();
    public DbSet<FinancialDocumentLine> FinancialDocumentLines => Set<FinancialDocumentLine>();
    public DbSet<Counterparty> Counterparties => Set<Counterparty>();
    public DbSet<PartyLedgerEntry> PartyLedgerEntries => Set<PartyLedgerEntry>();
    public DbSet<Settlement> Settlements => Set<Settlement>();
    public DbSet<PaymentAllocation> PaymentAllocations => Set<PaymentAllocation>();
    public DbSet<DocumentNumberSequence> DocumentNumberSequences => Set<DocumentNumberSequence>();
    public DbSet<AccountingOperation> AccountingOperations => Set<AccountingOperation>();
    public DbSet<AccountingState> AccountingStates => Set<AccountingState>();

    /// <summary>Maps additive accounting tables with restricted deletion and durable source uniqueness.</summary>
    private static void ConfigureAccounting(ModelBuilder model)
    {
        model.Entity<PaymentTransaction>().Property(x => x.VerificationEvidenceDigest).HasMaxLength(64);
        model.Entity<AccountingState>(b => { b.HasKey(x => x.Id); b.Property(x => x.Version).IsConcurrencyToken(); b.HasData(new AccountingState()); });
        model.Entity<DocumentNumberSequence>(b =>
        {
            b.HasKey(x => x.Kind);
            b.HasData(Enum.GetValues<DocumentKind>().Select(kind => new DocumentNumberSequence { Kind = kind }));
        });
        model.Entity<InventoryBalance>(b =>
        {
            b.HasKey(x => x.ProductId); b.Property(x => x.Version).IsConcurrencyToken();
            b.Ignore(x => x.Available); b.Ignore(x => x.AverageCost);
            b.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
            b.ToTable("InventoryBalances", t => t.HasCheckConstraint("CK_InventoryBalances_Quantities", "OnHand >= 0 AND Reserved >= 0 AND Reserved <= OnHand"));
        });
        model.Entity<StockMovement>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.SourceKey).HasMaxLength(240);
            b.Property(x => x.Reason).HasMaxLength(1000); b.HasIndex(x => x.SourceKey).IsUnique();
            b.HasIndex(x => new { x.ProductId, x.PostedAtUtc });
            b.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<StockMovement>().WithMany().HasForeignKey(x => x.ReversesMovementId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<StockReservation>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.Version).IsConcurrencyToken();
            b.HasIndex(x => x.OrderItemId).IsUnique(); b.HasIndex(x => new { x.Status, x.ExpiresAtUtc });
            b.HasOne<Order>().WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<OrderItem>().WithMany().HasForeignKey(x => x.OrderItemId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<Counterparty>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.Name).HasMaxLength(200).IsRequired();
            b.Property(x => x.Phone).HasMaxLength(50); b.Property(x => x.Address).HasMaxLength(2000);
            b.Property(x => x.Notes).HasMaxLength(3000); b.Property(x => x.RegistrationNumber).HasMaxLength(100);
            b.HasIndex(x => x.UserId).IsUnique(); b.Property(x => x.Version).IsConcurrencyToken();
            b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<FinancialDocument>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.Version).IsConcurrencyToken();
            b.Property(x => x.Number).HasMaxLength(40); b.HasIndex(x => x.Number).IsUnique();
            b.HasIndex(x => new { x.OrderId, x.Kind }).IsUnique();
            b.HasIndex(x => new { x.CustomerUserId, x.IssuedAtUtc }); b.HasIndex(x => new { x.Kind, x.Status, x.IssuedAtUtc });
            b.Ignore(x => x.Net); b.Ignore(x => x.Tax); b.Ignore(x => x.Total); b.Ignore(x => x.TotalToman);
            b.HasMany(x => x.Lines).WithOne().HasForeignKey(x => x.DocumentId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<Counterparty>().WithMany().HasForeignKey(x => x.CounterpartyId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<Order>().WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<FinancialDocument>().WithMany().HasForeignKey(x => x.OriginalDocumentId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<AppUser>().WithMany().HasForeignKey(x => x.CustomerUserId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<FinancialDocumentLine>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.Title).HasMaxLength(500); b.Ignore(x => x.Net);
            b.HasIndex(x => x.ProductId); b.HasIndex(x => x.OriginalLineId);
            b.HasOne<Product>().WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<FinancialDocumentLine>().WithMany().HasForeignKey(x => x.OriginalLineId).OnDelete(DeleteBehavior.Restrict);
            b.ToTable("FinancialDocumentLines", t => t.HasCheckConstraint("CK_FinancialDocumentLines_Quantity", "Quantity > 0"));
        });
        model.Entity<PartyLedgerEntry>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.SourceKey).HasMaxLength(240); b.HasIndex(x => x.SourceKey).IsUnique();
            b.HasIndex(x => new { x.CounterpartyId, x.PostedAtUtc });
            b.HasOne<Counterparty>().WithMany().HasForeignKey(x => x.CounterpartyId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<FinancialDocument>().WithMany().HasForeignKey(x => x.DocumentId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<Settlement>().WithMany().HasForeignKey(x => x.SettlementId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<Settlement>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.Reference).HasMaxLength(300);
            b.HasIndex(x => x.PaymentTransactionId).IsUnique();
            b.HasOne<Counterparty>().WithMany().HasForeignKey(x => x.CounterpartyId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<PaymentTransaction>().WithMany().HasForeignKey(x => x.PaymentTransactionId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<PaymentAllocation>(b =>
        {
            b.HasKey(x => x.Id); b.HasIndex(x => new { x.SettlementId, x.DocumentId });
            b.HasOne<Settlement>().WithMany().HasForeignKey(x => x.SettlementId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne<FinancialDocument>().WithMany().HasForeignKey(x => x.DocumentId).OnDelete(DeleteBehavior.Restrict);
        });
        model.Entity<AccountingOperation>(b =>
        {
            b.HasKey(x => x.Id); b.Property(x => x.Key).HasMaxLength(120); b.Property(x => x.Fingerprint).HasMaxLength(64);
            b.Property(x => x.Kind).HasMaxLength(60); b.HasIndex(x => new { x.ActorId, x.Key }).IsUnique();
        });
    }

    /// <summary>Rejects modifying/deleting append-only evidence or changing a finalized document's snapshots.</summary>
    private void ValidateAccountingChanges()
    {
        var pendingMovements = ChangeTracker.Entries<StockMovement>().Where(x => x.State == EntityState.Added).Select(x => x.Entity).ToList();
        foreach (var entry in ChangeTracker.Entries<InventoryBalance>().Where(x => x.State is EntityState.Added or EntityState.Modified or EntityState.Deleted))
        {
            if (entry.State == EntityState.Deleted) throw new InvalidOperationException("Inventory accounts cannot be deleted.");
            int oldQuantity = entry.State == EntityState.Added ? 0 : entry.OriginalValues.GetValue<int>(nameof(InventoryBalance.OnHand));
            int oldReserved = entry.State == EntityState.Added ? 0 : entry.OriginalValues.GetValue<int>(nameof(InventoryBalance.Reserved));
            decimal oldValue = entry.State == EntityState.Added ? 0 : entry.OriginalValues.GetValue<decimal>(nameof(InventoryBalance.Value));
            var movements = pendingMovements.Where(x => x.ProductId == entry.Entity.ProductId).ToList();
            if (entry.Entity.OnHand - oldQuantity != movements.Sum(x => x.QuantityDelta) ||
                entry.Entity.Reserved - oldReserved != movements.Sum(x => x.ReservedDelta) ||
                entry.Entity.Value - oldValue != movements.Sum(x => x.ValueDelta))
                throw new InvalidOperationException("Inventory changes require balanced immutable movement evidence.");
        }
        foreach (var added in ChangeTracker.Entries<FinancialDocumentLine>().Where(x => x.State == EntityState.Added))
        {
            var owner = ChangeTracker.Entries<FinancialDocument>().FirstOrDefault(x => x.Entity.Id == added.Entity.DocumentId);
            if (owner is { State: EntityState.Added }) continue;
            var status = owner is null ? FinancialDocuments.AsNoTracking().Where(x => x.Id == added.Entity.DocumentId).Select(x => x.Status).Single()
                : owner.OriginalValues.GetValue<DocumentStatus>(nameof(FinancialDocument.Status));
            if (status != DocumentStatus.Draft) throw new InvalidOperationException("Finalized document lines are immutable.");
        }
        var stockWrites = ChangeTracker.Entries<Product>().Where(x =>
            (x.State == EntityState.Modified && x.Property(p => p.StockQuantity).IsModified) ||
            (x.State == EntityState.Added && x.Entity.StockQuantity != 0)).ToList();
        if (stockWrites.Count > 0 && AccountingStates.AsNoTracking().Any(x => x.Id == 1 && x.Activated))
        {
            foreach (var product in stockWrites)
                if (!_authorizedStockProjections.TryGetValue(product.Entity.Id, out int expected) || expected != product.Entity.StockQuantity)
                    throw new InvalidOperationException("Stock must be changed through an authorized inventory movement.");
        }
        _authorizedStockProjections.Clear();
        foreach (var entry in ChangeTracker.Entries().Where(x => x.State is EntityState.Modified or EntityState.Deleted))
        {
            if (entry.Entity is StockMovement or PartyLedgerEntry or Settlement or PaymentAllocation or AccountingOperation)
                throw new InvalidOperationException($"Accounting evidence is append-only ({entry.Metadata.ClrType.Name}: {string.Join(',', entry.Properties.Where(p => p.IsModified).Select(p => p.Metadata.Name))}).");
            if (entry.Entity is FinancialDocument && entry.OriginalValues.GetValue<DocumentStatus>(nameof(FinancialDocument.Status)) != DocumentStatus.Draft)
                throw new InvalidOperationException("Finalized documents are immutable.");
            if (entry.Entity is FinancialDocumentLine line)
            {
                var owner = ChangeTracker.Entries<FinancialDocument>().FirstOrDefault(x => x.Entity.Id == line.DocumentId);
                var status = owner is null ? FinancialDocuments.AsNoTracking().Where(x => x.Id == line.DocumentId).Select(x => x.Status).Single()
                    : owner.OriginalValues.GetValue<DocumentStatus>(nameof(FinancialDocument.Status));
                if (status != DocumentStatus.Draft) throw new InvalidOperationException("Finalized document lines are immutable.");
            }
        }
    }
}
