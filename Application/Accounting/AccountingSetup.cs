using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Domain.Accounting;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

public sealed record SetupProduct(Guid Id, int ProductCode, string Title, string Slug, int StockQuantity);
public sealed record SetupPreviewDto(bool Activated, string Fingerprint, IReadOnlyList<SetupProduct> Products,
    IReadOnlyList<Guid> OpenOrderIds, int ActiveReservations);
public sealed record HistoricalPaymentPreview(Guid PaymentId, Guid OrderId, string OrderNumber, decimal AmountToman,
    bool Eligible, string? Blocker, string Fingerprint);

/// <summary>Explicit, previewed inventory cutover. Merely applying migrations never executes it.</summary>
public static class AccountingSetup
{
    public sealed record Preview : IRequest<SetupPreviewDto>;
    public sealed record Activate(Guid Actor, string Key, IReadOnlyList<Guid> ProductIds, string PreviewFingerprint, string Confirmation) : IRequest<Guid>;
    public sealed record HistoricalPreview : IRequest<IReadOnlyList<HistoricalPaymentPreview>>;

    /// <summary>Reads current quantities and blockers without modifying stock, payments or reservations.</summary>
    public sealed class PreviewHandler(AppDbContext db) : IRequestHandler<Preview, SetupPreviewDto>
    {
        public Task<SetupPreviewDto> Handle(Preview request, CancellationToken ct) => BuildPreviewAsync(db, ct);
    }

    /// <summary>Zeroes explicitly selected demo stock with audit movements and blocks open commerce or omitted positive balances.</summary>
    public sealed class ActivateHandler(AppDbContext db, AccountingUnitOfWork work, InventoryPosting inventory, TimeProvider time) : IRequestHandler<Activate, Guid>
    {
        public Task<Guid> Handle(Activate r, CancellationToken ct) => work.ExecuteAsync(r.Actor, r.Key, "activate-accounting", r,
            async token =>
            {
                if (r.Confirmation != "ZERO_SELECTED_DEMO_STOCK" || r.ProductIds is null || r.ProductIds.Count > 10000 ||
                    r.ProductIds.Distinct().Count() != r.ProductIds.Count) throw new AccountingException("EXPLICIT_SETUP_CONFIRMATION_REQUIRED", 400);
                var preview = await BuildPreviewAsync(db, token);
                if (preview.Activated) throw new AccountingException("ACCOUNTING_ALREADY_ACTIVE");
                if (preview.Fingerprint != r.PreviewFingerprint) throw new AccountingException("SETUP_PREVIEW_CHANGED");
                if (preview.OpenOrderIds.Count > 0 || preview.ActiveReservations > 0) throw new AccountingException("OPEN_COMMERCE_BLOCKS_SETUP");
                if (preview.Products.Any(x => x.StockQuantity > 0 && !r.ProductIds.Contains(x.Id)))
                    throw new AccountingException("UNRESOLVED_POSITIVE_LEGACY_STOCK");
                if (r.ProductIds.Any(id => !preview.Products.Any(p => p.Id == id))) throw new AccountingException("PRODUCT_NOT_FOUND", 404);
                foreach (var item in preview.Products.Where(x => r.ProductIds.Contains(x.Id)))
                {
                    if (await db.InventoryBalances.AnyAsync(x => x.ProductId == item.Id, token)) throw new AccountingException("EXISTING_INVENTORY_BLOCKS_SETUP");
                    var balance = new InventoryBalance(item.Id); db.InventoryBalances.Add(balance);
                    if (item.StockQuantity != 0)
                    {
                        await inventory.RecordAsync(balance, $"demo-opening:{item.Id}", StockMovementKind.DemoOpening, item.StockQuantity, 0, 0,
                            r.Actor, "Explicitly confirmed unvalued demonstration quantity; not a real asset or purchase", token);
                        await inventory.RecordAsync(balance, $"demo-reset:{item.Id}", StockMovementKind.DemoReset, -item.StockQuantity, 0, 0,
                            r.Actor, "Administrator-confirmed demonstration-stock reset", token);
                    }
                }
                var state = await db.AccountingStates.SingleAsync(token); state.Activated = true; state.ActivatedAtUtc = time.GetUtcNow().UtcDateTime;
                return Guid.NewGuid();
            }, ct);
    }

    /// <summary>Classifies historical evidence without adopting seeded flags as real financial receipts.</summary>
    public sealed class HistoricalPreviewHandler(AppDbContext db) : IRequestHandler<HistoricalPreview, IReadOnlyList<HistoricalPaymentPreview>>
    {
        public async Task<IReadOnlyList<HistoricalPaymentPreview>> Handle(HistoricalPreview request, CancellationToken ct)
        {
            var payments = await db.PaymentTransactions.AsNoTracking().Include(x => x.Order).ThenInclude(x => x.Items)
                .Where(x => x.Status == PaymentStatus.Verified && !db.Settlements.Any(s => s.PaymentTransactionId == x.Id))
                .OrderBy(x => x.CreatedAtUtc).Take(500).ToListAsync(ct);
            return payments.Select(p => new HistoricalPaymentPreview(p.Id, p.OrderId, p.Order.OrderNumber, p.Amount,
                p.VerifiedAtUtc.HasValue && p.VerificationEvidenceDigest?.Length == 64 && !p.Order.OrderNumber.StartsWith("ORD-SEED-")
                    && !(p.ReferenceId ?? "").StartsWith("TEST-") && p.Provider != PaymentProvider.Unknown,
                p.VerifiedAtUtc.HasValue && p.VerificationEvidenceDigest?.Length == 64 ? null : "UNPROVEN_SERVER_VERIFICATION",
                CommercePosting.PreviewFingerprint(p))).ToList();
        }
    }

    /// <summary>Builds a stable data fingerprint; the transient lock version is deliberately not part of the preview.</summary>
    private static async Task<SetupPreviewDto> BuildPreviewAsync(AppDbContext db, CancellationToken ct)
    {
        bool active = await db.AccountingStates.AsNoTracking().AnyAsync(x => x.Id == 1 && x.Activated, ct);
        var products = await db.Products.AsNoTracking().OrderBy(x => x.Id).Select(x => new SetupProduct(x.Id, x.ProductCode, x.Title, x.Slug, x.StockQuantity)).ToListAsync(ct);
        var open = await db.Orders.AsNoTracking().Where(x => x.Status != OrderStatus.Cancelled && x.Status != OrderStatus.Delivered && x.Status != OrderStatus.Refunded)
            .OrderBy(x => x.Id).Select(x => x.Id).ToListAsync(ct);
        var holds = await db.StockReservations.AsNoTracking().Where(x => x.Status == ReservationStatus.Active)
            .OrderBy(x => x.Id).Select(x => new { x.Id, x.ProductId, x.Quantity, x.Version }).ToListAsync(ct);
        string fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { active, products, open, holds }))));
        return new(active, fingerprint, products, open, holds.Count);
    }
}
