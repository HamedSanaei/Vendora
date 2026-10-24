using Domain.Accounting;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

public sealed record DocumentSummaryDto(int PostedCount, int DraftCount, decimal PostedTotalToman, decimal ReturnTotalToman,
    decimal OutstandingToman, int CustomerIssuedCount);
public sealed record PartySummaryDto(int Total, int Debtors, int Creditors, int LinkedUsers);
public sealed record SettlementSummaryDto(decimal ReceiptsToman, decimal PaymentsToman, decimal UnallocatedReceiptsToman, int RequiresReview);
public sealed record InventorySummaryDto(long OnHand, long Reserved, long Available, decimal ValueToman);

/// <summary>Focused read-only metrics used by the actual Penpot summary cards; all amounts come from persisted evidence.</summary>
public static class AccountingSummaries
{
    public sealed record Documents(DocumentKind Kind, DateTime? FromUtc = null, DateTime? ToUtc = null) : IRequest<DocumentSummaryDto>;
    public sealed record Parties : IRequest<PartySummaryDto>;
    public sealed record Settlements : IRequest<SettlementSummaryDto>;
    public sealed record Inventory : IRequest<InventorySummaryDto>;

    /// <summary>Summarizes one document family with genuine return credits and allocations; quotes never create receivables.</summary>
    public sealed class DocumentsHandler(AppDbContext db) : IRequestHandler<Documents, DocumentSummaryDto>
    {
        public async Task<DocumentSummaryDto> Handle(Documents r, CancellationToken ct)
        {
            var q = db.FinancialDocuments.AsNoTracking().Where(x => x.Kind == r.Kind);
            if (r.FromUtc.HasValue) q = q.Where(x => x.IssuedAtUtc >= r.FromUtc);
            if (r.ToUtc.HasValue) q = q.Where(x => x.IssuedAtUtc <= r.ToUtc);
            var docs = await q.Include(x => x.Lines).ToListAsync(ct);
            var posted = docs.Where(x => x.Status == DocumentStatus.Posted).ToList();
            var ids = posted.Select(x => x.Id).ToList();
            var credits = await db.FinancialDocuments.AsNoTracking().Include(x => x.Lines)
                .Where(x => x.OriginalDocumentId.HasValue && ids.Contains(x.OriginalDocumentId.Value) && x.Status == DocumentStatus.Posted).ToListAsync(ct);
            var assigned = await db.PaymentAllocations.AsNoTracking().Where(x => ids.Contains(x.DocumentId))
                .Select(x => new { x.DocumentId, x.AmountToman }).ToListAsync(ct);
            return new(posted.Count, docs.Count(x => x.Status == DocumentStatus.Draft), posted.Sum(x => x.TotalToman), credits.Sum(x => x.TotalToman),
                r.Kind == DocumentKind.Proforma ? 0 : posted.Sum(doc => Math.Max(0, doc.TotalToman - assigned.Where(x => x.DocumentId == doc.Id).Sum(x => x.AmountToman)
                    - credits.Where(x => x.OriginalDocumentId == doc.Id).Sum(x => x.TotalToman))),
                posted.Count(x => x.CustomerUserId.HasValue));
        }
    }

    /// <summary>Counts identities and net debtor/creditor parties without merging similar names/phones.</summary>
    public sealed class PartiesHandler(AppDbContext db) : IRequestHandler<Parties, PartySummaryDto>
    {
        public async Task<PartySummaryDto> Handle(Parties r, CancellationToken ct)
        {
            var parties = await db.Counterparties.AsNoTracking().Select(x => x.UserId).ToListAsync(ct);
            var ledger = await db.PartyLedgerEntries.AsNoTracking().Select(x => new { x.CounterpartyId, x.AmountToman }).ToListAsync(ct);
            var balances = ledger.GroupBy(x => x.CounterpartyId).Select(g => g.Sum(x => x.AmountToman)).ToList();
            return new(parties.Count, balances.Count(x => x > 0), balances.Count(x => x < 0), parties.Count(x => x.HasValue));
        }
    }

    /// <summary>Reports actual money and unallocated advances rather than inferring paid status from invoices.</summary>
    public sealed class SettlementsHandler(AppDbContext db) : IRequestHandler<Settlements, SettlementSummaryDto>
    {
        public async Task<SettlementSummaryDto> Handle(Settlements r, CancellationToken ct)
        {
            var money = await db.Settlements.AsNoTracking().ToListAsync(ct);
            var allocations = await db.PaymentAllocations.AsNoTracking().Select(x => new { x.SettlementId, x.AmountToman }).ToListAsync(ct);
            return new(money.Where(x => x.Direction == SettlementDirection.Receipt).Sum(x => x.AmountToman),
                money.Where(x => x.Direction == SettlementDirection.Payment).Sum(x => x.AmountToman),
                money.Where(x => x.Direction == SettlementDirection.Receipt).Sum(x => x.AmountToman - allocations.Where(a => a.SettlementId == x.Id).Sum(a => a.AmountToman)),
                money.Count(x => x.RequiresReview));
        }
    }

    /// <summary>Reads physical/reserved/free stock totals independently from product compatibility quantities.</summary>
    public sealed class InventoryHandler(AppDbContext db) : IRequestHandler<Inventory, InventorySummaryDto>
    {
        public async Task<InventorySummaryDto> Handle(Inventory r, CancellationToken ct)
        {
            var rows = await db.InventoryBalances.AsNoTracking().Select(x => new { x.OnHand, x.Reserved, x.Value }).ToListAsync(ct);
            long onHand = rows.Sum(x => (long)x.OnHand), reserved = rows.Sum(x => (long)x.Reserved);
            return new(onHand, reserved, onHand - reserved, rows.Sum(x => x.Value));
        }
    }
}
