using Domain.Accounting;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

public sealed record PartyDto(Guid Id, Guid? UserId, string Name, string Phone, string Address, CounterpartyRole Role,
    bool IsLegalEntity, string? RegistrationNumber, string Notes, long Version, decimal BalanceToman = 0);
public sealed record MovementDto(Guid Id, Guid ProductId, StockMovementKind Kind, int QuantityDelta, int ReservedDelta,
    decimal ValueDelta, DateTime PostedAtUtc, string SourceKey, string Reason, Guid? ReversesMovementId);
public sealed record InventoryDto(Guid ProductId, int ProductCode, string Title, int OnHand, int Reserved, int Available,
    decimal ValueToman, decimal AverageCostToman, long Version);
public sealed record LedgerDto(Guid Id, Guid? DocumentId, Guid? SettlementId, decimal AmountToman, DateTime PostedAtUtc);
public sealed record PartyLedgerDto(Guid CounterpartyId, decimal BalanceToman, PageResult<LedgerDto> Entries);
public sealed record SettlementDto(Guid Id, Guid CounterpartyId, SettlementDirection Direction, SettlementMethod Method,
    decimal AmountToman, decimal AllocatedToman, string Reference, DateTime OccurredAtUtc, bool RequiresReview);
public sealed record AccountingOverviewDto(bool Activated, int PostedSales, int PostedPurchases, decimal SalesNetToman,
    decimal PurchasesNetToman, decimal InventoryValueToman, decimal GrossProfitKnownToman, int UnknownCostLines,
    decimal ReceivablesToman, decimal PayablesToman, decimal PurchaseReturnDifferenceToman);
public sealed record ProductPriceHistoryDto(Guid DocumentId, string Number, DocumentKind Kind, DateTime IssuedAtUtc,
    Guid CounterpartyId, string BuyerSnapshotJson, int Quantity, DocumentCurrency Currency, decimal ExchangeRate,
    decimal UnitPrice, decimal Discount, decimal Tax, decimal? CapturedCostToman, Guid LineId);
public sealed record OrderReservationDto(Guid Id, Guid ProductId, int Quantity, ReservationStatus Status, DateTime ExpiresAtUtc);
public sealed record OrderAccountingDto(bool Activated, bool HasServerVerification, string PaymentStatus, Guid? InvoiceId,
    string? InvoiceNumber, bool PaymentRequiresReview, IReadOnlyList<OrderReservationDto> Reservations);
public sealed record ReturnableLine(Guid LineId, int ReturnedQuantity, int RemainingQuantity);
public sealed record DocumentContextDto(decimal AllocatedToman, decimal CreditedToman, decimal OutstandingToman,
    IReadOnlyList<ReturnableLine> ReturnableLines);
public sealed record AccountingStatusDto(bool Activated);

/// <summary>Read-only accounting use cases. Monetary aggregation uses decimal in memory for SQLite compatibility.</summary>
public static class AccountingQueries
{
    public sealed record Documents(DocumentKind? Kind = null, DocumentStatus? Status = null, string? Search = null,
        int Page = 1, int PageSize = 25, Guid? CounterpartyId = null, DocumentCurrency? Currency = null,
        DateTime? FromUtc = null, DateTime? ToUtc = null) : IRequest<PageResult<AdminDocumentDto>>;
    public sealed record Document(Guid Id) : IRequest<AdminDocumentDto?>;
    public sealed record Parties(string? Search = null, int Page = 1) : IRequest<PageResult<PartyDto>>;
    public sealed record Party(Guid Id) : IRequest<PartyDto?>;
    public sealed record Ledger(Guid PartyId, int Page = 1) : IRequest<PartyLedgerDto?>;
    public sealed record Movements(Guid? ProductId = null, int Page = 1) : IRequest<PageResult<MovementDto>>;
    public sealed record Inventory(int Page = 1, Guid? ProductId = null) : IRequest<PageResult<InventoryDto>>;
    public sealed record Settlements(Guid? PartyId = null, int Page = 1) : IRequest<PageResult<SettlementDto>>;
    public sealed record Overview(DateTime? FromUtc = null, DateTime? ToUtc = null) : IRequest<AccountingOverviewDto>;
    public sealed record Mine(Guid UserId, int Page = 1, DocumentKind? Kind = null) : IRequest<PageResult<CustomerDocumentDto>>;
    public sealed record MyDocument(Guid UserId, Guid Id) : IRequest<CustomerDocumentDto?>;
    public sealed record ProductPrices(Guid ProductId, int Page = 1) : IRequest<PageResult<ProductPriceHistoryDto>>;
    public sealed record OrderContext(Guid OrderId) : IRequest<OrderAccountingDto?>;
    public sealed record DocumentContext(Guid Id) : IRequest<DocumentContextDto?>;
    public sealed record Status : IRequest<AccountingStatusDto>;

    /// <summary>Reads only activation for existing product editors, without loading financial documents or metrics.</summary>
    public sealed class StatusHandler(AppDbContext db) : IRequestHandler<Status, AccountingStatusDto>
    {
        public async Task<AccountingStatusDto> Handle(Status request, CancellationToken ct)
            => new(await db.AccountingStates.AsNoTracking().AnyAsync(x => x.Id == 1 && x.Activated, ct));
    }

    /// <summary>Reads actual remaining quantities and settlement amounts for return/allocation forms.</summary>
    public sealed class DocumentContextHandler(AppDbContext db) : IRequestHandler<DocumentContext, DocumentContextDto?>
    {
        public async Task<DocumentContextDto?> Handle(DocumentContext request, CancellationToken ct)
        {
            var doc = await db.FinancialDocuments.AsNoTracking().Include(x => x.Lines).SingleOrDefaultAsync(x => x.Id == request.Id, ct);
            if (doc is null) return null;
            var returns = await db.FinancialDocuments.AsNoTracking().Include(x => x.Lines).Where(x => x.OriginalDocumentId == doc.Id && x.Status == DocumentStatus.Posted).ToListAsync(ct);
            var allocations = await db.PaymentAllocations.AsNoTracking().Where(x => x.DocumentId == doc.Id).Select(x => x.AmountToman).ToListAsync(ct);
            decimal credited = returns.Sum(x => x.TotalToman), allocated = allocations.Sum();
            return new(allocated, credited, Math.Max(0, doc.TotalToman - credited - allocated), doc.Lines.Select(line =>
            {
                int returned = returns.SelectMany(x => x.Lines).Where(x => x.OriginalLineId == line.Id).Sum(x => x.Quantity);
                return new ReturnableLine(line.Id, returned, line.Quantity - returned);
            }).ToList());
        }
    }

    /// <summary>Extends existing order details with actual reservation/provenance/invoice context, without replacing order management.</summary>
    public sealed class OrderContextHandler(AppDbContext db) : IRequestHandler<OrderContext, OrderAccountingDto?>
    {
        public async Task<OrderAccountingDto?> Handle(OrderContext r, CancellationToken ct)
        {
            var order = await db.Orders.AsNoTracking().SingleOrDefaultAsync(x => x.Id == r.OrderId, ct);
            if (order is null) return null;
            var holds = await db.StockReservations.AsNoTracking().Where(x => x.OrderId == r.OrderId).OrderBy(x => x.ExpiresAtUtc)
                .Select(x => new OrderReservationDto(x.Id, x.ProductId, x.Quantity, x.Status, x.ExpiresAtUtc)).ToListAsync(ct);
            var invoice = await db.FinancialDocuments.AsNoTracking().Where(x => x.OrderId == r.OrderId && x.Kind == DocumentKind.Sale && x.Status == DocumentStatus.Posted)
                .Select(x => new { x.Id, x.Number }).SingleOrDefaultAsync(ct);
            bool verified = await db.PaymentTransactions.AsNoTracking().AnyAsync(x => x.OrderId == r.OrderId && x.Status == Domain.Enums.PaymentStatus.Verified
                && x.VerifiedAtUtc != null && x.VerificationEvidenceDigest != null, ct);
            bool review = await db.Settlements.AsNoTracking().AnyAsync(x => x.RequiresReview && db.PaymentTransactions.Any(p => p.Id == x.PaymentTransactionId && p.OrderId == r.OrderId), ct);
            return new(await db.AccountingStates.AsNoTracking().AnyAsync(x => x.Activated, ct), verified, order.PaymentStatus.ToString(), invoice?.Id, invoice?.Number, review, holds);
        }
    }

    /// <summary>Shows each product's historical buy/sell prices and captured costs from original immutable invoice snapshots.</summary>
    public sealed class ProductPricesHandler(AppDbContext db) : IRequestHandler<ProductPrices, PageResult<ProductPriceHistoryDto>>
    {
        public async Task<PageResult<ProductPriceHistoryDto>> Handle(ProductPrices r, CancellationToken ct)
        {
            int page = Math.Clamp(r.Page, 1, 100000);
            var query = from line in db.FinancialDocumentLines.AsNoTracking()
                join doc in db.FinancialDocuments.AsNoTracking() on line.DocumentId equals doc.Id
                where line.ProductId == r.ProductId && doc.Status == DocumentStatus.Posted && doc.Kind != DocumentKind.Proforma
                select new { Document = doc, Line = line };
            int total = await query.CountAsync(ct);
            // Apply ordering/paging before the record constructor so EF translates the complete query to SQL.
            var rows = await query.OrderByDescending(x => x.Document.IssuedAtUtc).ThenBy(x => x.Document.Id).ThenBy(x => x.Line.Id)
                .Skip((page - 1) * 25).Take(25).Select(x => new ProductPriceHistoryDto(x.Document.Id, x.Document.Number,
                    x.Document.Kind, x.Document.IssuedAtUtc, x.Document.CounterpartyId, x.Document.BuyerSnapshotJson,
                    x.Line.Quantity, x.Document.Currency, x.Document.ExchangeRate, x.Line.UnitPrice, x.Line.Discount,
                    x.Line.Tax, x.Line.CostToman, x.Line.Id)).ToListAsync(ct);
            return new(rows, page, 25, total);
        }
    }

    /// <summary>Paginates internal commercial documents without returning EF entities.</summary>
    public sealed class DocumentsHandler(AppDbContext db) : IRequestHandler<Documents, PageResult<AdminDocumentDto>>
    {
        public async Task<PageResult<AdminDocumentDto>> Handle(Documents r, CancellationToken ct)
        {
            int page = Math.Clamp(r.Page, 1, 100000), size = Math.Clamp(r.PageSize, 1, 100);
            var query = db.FinancialDocuments.AsNoTracking().AsQueryable();
            if (r.Kind.HasValue) query = query.Where(x => x.Kind == r.Kind);
            if (r.Status.HasValue) query = query.Where(x => x.Status == r.Status);
            if (!string.IsNullOrWhiteSpace(r.Search)) query = query.Where(x => x.Number.Contains(r.Search)
                || db.Counterparties.Any(p => p.Id == x.CounterpartyId && p.Name.Contains(r.Search)));
            if (r.CounterpartyId.HasValue) query = query.Where(x => x.CounterpartyId == r.CounterpartyId);
            if (r.Currency.HasValue) query = query.Where(x => x.Currency == r.Currency);
            if (r.FromUtc.HasValue) query = query.Where(x => x.IssuedAtUtc >= r.FromUtc);
            if (r.ToUtc.HasValue) query = query.Where(x => x.IssuedAtUtc <= r.ToUtc);
            int total = await query.CountAsync(ct);
            var rows = await query.OrderByDescending(x => x.IssuedAtUtc).ThenBy(x => x.Id).Skip((page - 1) * size).Take(size).Include(x => x.Lines).ToListAsync(ct);
            return new(rows.Select(AccountingMappings.Admin).ToList(), page, size, total);
        }
    }
    /// <summary>Reads one internal document and captured cost lines.</summary>
    public sealed class DocumentHandler(AppDbContext db) : IRequestHandler<Document, AdminDocumentDto?>
    {
        public async Task<AdminDocumentDto?> Handle(Document r, CancellationToken ct)
        {
            var doc = await db.FinancialDocuments.AsNoTracking().Include(x => x.Lines).SingleOrDefaultAsync(x => x.Id == r.Id, ct);
            return doc is null ? null : AccountingMappings.Admin(doc);
        }
    }
    /// <summary>Searches explicit parties without deriving identities from display names.</summary>
    public sealed class PartiesHandler(AppDbContext db) : IRequestHandler<Parties, PageResult<PartyDto>>
    {
        public async Task<PageResult<PartyDto>> Handle(Parties r, CancellationToken ct)
        {
            int page = Math.Clamp(r.Page, 1, 100000);
            var q = db.Counterparties.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(r.Search)) q = q.Where(x => x.Name.Contains(r.Search) || x.Phone.Contains(r.Search));
            int total = await q.CountAsync(ct);
            var rows = await q.OrderBy(x => x.Name).ThenBy(x => x.Id).Skip((page - 1) * 25).Take(25)
                .Select(x => new PartyDto(x.Id, x.UserId, x.Name, x.Phone, x.Address, x.Role, x.IsLegalEntity, x.RegistrationNumber, x.Notes, x.Version, 0)).ToListAsync(ct);
            var ids = rows.Select(x => x.Id).ToList();
            var ledger = await db.PartyLedgerEntries.AsNoTracking().Where(x => ids.Contains(x.CounterpartyId))
                .Select(x => new { x.CounterpartyId, x.AmountToman }).ToListAsync(ct);
            return new(rows.Select(row => row with { BalanceToman = ledger.Where(x => x.CounterpartyId == row.Id).Sum(x => x.AmountToman) }).ToList(), page, 25, total);
        }
    }
    /// <summary>Reads an explicit party identity for its existing ledger screen; never matches by phone/name.</summary>
    public sealed class PartyHandler(AppDbContext db) : IRequestHandler<Party, PartyDto?>
    {
        public async Task<PartyDto?> Handle(Party r, CancellationToken ct)
        {
            var party = await db.Counterparties.AsNoTracking().SingleOrDefaultAsync(x => x.Id == r.Id, ct);
            if (party is null) return null;
            var entries = await db.PartyLedgerEntries.AsNoTracking().Where(x => x.CounterpartyId == party.Id).Select(x => x.AmountToman).ToListAsync(ct);
            return new(party.Id, party.UserId, party.Name, party.Phone, party.Address, party.Role, party.IsLegalEntity, party.RegistrationNumber, party.Notes, party.Version, entries.Sum());
        }
    }
    /// <summary>Returns a paged immutable party ledger plus the complete Toman balance.</summary>
    public sealed class LedgerHandler(AppDbContext db) : IRequestHandler<Ledger, PartyLedgerDto?>
    {
        public async Task<PartyLedgerDto?> Handle(Ledger r, CancellationToken ct)
        {
            if (!await db.Counterparties.AsNoTracking().AnyAsync(x => x.Id == r.PartyId, ct)) return null;
            int page = Math.Clamp(r.Page, 1, 100000);
            var q = db.PartyLedgerEntries.AsNoTracking().Where(x => x.CounterpartyId == r.PartyId);
            var amounts = await q.Select(x => x.AmountToman).ToListAsync(ct);
            var entries = await q.OrderByDescending(x => x.PostedAtUtc).ThenBy(x => x.Id).Skip((page - 1) * 25).Take(25)
                .Select(x => new LedgerDto(x.Id, x.DocumentId, x.SettlementId, x.AmountToman, x.PostedAtUtc)).ToListAsync(ct);
            return new(r.PartyId, amounts.Sum(), new(entries, page, 25, amounts.Count));
        }
    }
    /// <summary>Reads immutable stock evidence, including reservation deltas.</summary>
    public sealed class MovementsHandler(AppDbContext db) : IRequestHandler<Movements, PageResult<MovementDto>>
    {
        public async Task<PageResult<MovementDto>> Handle(Movements r, CancellationToken ct)
        {
            int page = Math.Clamp(r.Page, 1, 100000);
            var q = db.StockMovements.AsNoTracking(); if (r.ProductId.HasValue) q = q.Where(x => x.ProductId == r.ProductId);
            int total = await q.CountAsync(ct);
            var rows = await q.OrderByDescending(x => x.PostedAtUtc).ThenBy(x => x.Id).Skip((page - 1) * 25).Take(25)
                .Select(x => new MovementDto(x.Id, x.ProductId, x.Kind, x.QuantityDelta, x.ReservedDelta, x.ValueDelta,
                    x.PostedAtUtc, x.SourceKey, x.Reason, x.ReversesMovementId)).ToListAsync(ct);
            return new(rows, page, 25, total);
        }
    }
    /// <summary>Reads physical/reserved quantities and moving-average valuation with product snapshots.</summary>
    public sealed class InventoryHandler(AppDbContext db) : IRequestHandler<Inventory, PageResult<InventoryDto>>
    {
        public async Task<PageResult<InventoryDto>> Handle(Inventory r, CancellationToken ct)
        {
            int page = Math.Clamp(r.Page, 1, 100000);
            var products = db.Products.VisibleInUi(db).AsNoTracking().Where(x => !r.ProductId.HasValue || x.Id == r.ProductId);
            int total = await products.CountAsync(ct);
            var rows = await (from p in products join b in db.InventoryBalances.AsNoTracking() on p.Id equals b.ProductId into balances
                from b in balances.DefaultIfEmpty()
                orderby p.ProductCode select new { ProductId = p.Id, p.ProductCode, p.Title,
                    OnHand = b == null ? 0 : b.OnHand, Reserved = b == null ? 0 : b.Reserved, Value = b == null ? 0 : b.Value, Version = b == null ? 0 : b.Version })
                .Skip((page - 1) * 25).Take(25).ToListAsync(ct);
            return new(rows.Select(x => new InventoryDto(x.ProductId, x.ProductCode, x.Title, x.OnHand, x.Reserved,
                x.OnHand - x.Reserved, x.Value, x.OnHand == 0 ? 0 : x.Value / x.OnHand, x.Version)).ToList(), page, 25, total);
        }
    }
    /// <summary>Lists real receipts/payments with their remaining unallocated balance.</summary>
    public sealed class SettlementsHandler(AppDbContext db) : IRequestHandler<Settlements, PageResult<SettlementDto>>
    {
        public async Task<PageResult<SettlementDto>> Handle(Settlements r, CancellationToken ct)
        {
            int page = Math.Clamp(r.Page, 1, 100000);
            var q = db.Settlements.AsNoTracking(); if (r.PartyId.HasValue) q = q.Where(x => x.CounterpartyId == r.PartyId);
            int total = await q.CountAsync(ct);
            var rows = await q.OrderByDescending(x => x.PostedAtUtc).ThenBy(x => x.Id).Skip((page - 1) * 25).Take(25).ToListAsync(ct);
            var ids = rows.Select(x => x.Id).ToList();
            var allocations = await db.PaymentAllocations.AsNoTracking().Where(x => ids.Contains(x.SettlementId))
                .Select(x => new { x.SettlementId, x.AmountToman }).ToListAsync(ct);
            return new(rows.Select(x => new SettlementDto(x.Id, x.CounterpartyId, x.Direction, x.Method, x.AmountToman,
                allocations.Where(a => a.SettlementId == x.Id).Sum(a => a.AmountToman), x.Reference, x.OccurredAtUtc, x.RequiresReview)).ToList(), page, 25, total);
        }
    }
    /// <summary>Computes actual commercial reports; unknown historical costs remain explicit, never fabricated as zero profit.</summary>
    public sealed class OverviewHandler(AppDbContext db) : IRequestHandler<Overview, AccountingOverviewDto>
    {
        public async Task<AccountingOverviewDto> Handle(Overview r, CancellationToken ct)
        {
            var q = db.FinancialDocuments.AsNoTracking().Where(x => x.Status == DocumentStatus.Posted && x.Kind != DocumentKind.Proforma);
            if (r.FromUtc.HasValue) q = q.Where(x => x.IssuedAtUtc >= r.FromUtc);
            if (r.ToUtc.HasValue) q = q.Where(x => x.IssuedAtUtc <= r.ToUtc);
            var docs = await q.Include(x => x.Lines).ToListAsync(ct);
            var inventory = await db.InventoryBalances.AsNoTracking().Select(x => x.Value).ToListAsync(ct);
            var ledger = await db.PartyLedgerEntries.AsNoTracking().Select(x => new { x.CounterpartyId, x.AmountToman }).ToListAsync(ct);
            var balances = ledger.GroupBy(x => x.CounterpartyId).Select(x => x.Sum(a => a.AmountToman)).ToList();
            var sales = docs.Where(x => x.Kind is DocumentKind.Sale or DocumentKind.SalesReturn).ToList();
            decimal netSales = sales.Sum(x => (x.Kind == DocumentKind.Sale ? 1 : -1) * x.Net * x.ExchangeRate);
            decimal knownProfit = sales.Sum(d => d.Lines.Where(l => l.CostToman.HasValue).Sum(l =>
                (d.Kind == DocumentKind.Sale ? 1 : -1) * (l.Net * d.ExchangeRate - l.CostToman!.Value)));
            return new(await db.AccountingStates.AsNoTracking().AnyAsync(x => x.Id == 1 && x.Activated, ct),
                docs.Count(x => x.Kind == DocumentKind.Sale), docs.Count(x => x.Kind == DocumentKind.Purchase), netSales,
                docs.Where(x => x.Kind is DocumentKind.Purchase or DocumentKind.PurchaseReturn).Sum(x => (x.Kind == DocumentKind.Purchase ? 1 : -1) * x.Net * x.ExchangeRate),
                inventory.Sum(), knownProfit, sales.Sum(x => x.Lines.Count(l => !l.CostToman.HasValue)),
                balances.Where(x => x > 0).Sum(), -balances.Where(x => x < 0).Sum(),
                docs.Where(x => x.Kind == DocumentKind.PurchaseReturn).SelectMany(x => x.Lines).Sum(x => x.ValuationDifferenceToman ?? 0));
        }
    }
    /// <summary>Returns only the authenticated customer's posted sales/proformas, using the isolated public DTO.</summary>
    public sealed class MineHandler(AppDbContext db) : IRequestHandler<Mine, PageResult<CustomerDocumentDto>>
    {
        public async Task<PageResult<CustomerDocumentDto>> Handle(Mine r, CancellationToken ct)
        {
            int page = Math.Clamp(r.Page, 1, 100000);
            var q = CustomerDocuments(db, r.UserId);
            if (r.Kind.HasValue) q = q.Where(x => x.Kind == r.Kind);
            int total = await q.CountAsync(ct);
            var rows = await q.OrderByDescending(x => x.IssuedAtUtc).ThenBy(x => x.Id).Skip((page - 1) * 25).Take(25).Include(x => x.Lines).ToListAsync(ct);
            return new(rows.Select(AccountingMappings.Customer).ToList(), page, 25, total);
        }
    }
    /// <summary>Checks ownership in the query, including customer PDF source reads.</summary>
    public sealed class MyDocumentHandler(AppDbContext db) : IRequestHandler<MyDocument, CustomerDocumentDto?>
    {
        public async Task<CustomerDocumentDto?> Handle(MyDocument r, CancellationToken ct)
        {
            var doc = await CustomerDocuments(db, r.UserId).Include(x => x.Lines).SingleOrDefaultAsync(x => x.Id == r.Id, ct);
            return doc is null ? null : AccountingMappings.Customer(doc);
        }
    }
    /// <summary>Central ownership/type filter excludes drafts, suppliers and internal purchasing records.</summary>
    private static IQueryable<FinancialDocument> CustomerDocuments(AppDbContext db, Guid userId) => db.FinancialDocuments.AsNoTracking()
        .Where(x => x.CustomerUserId == userId && x.Status == DocumentStatus.Posted && (x.Kind == DocumentKind.Proforma || x.Kind == DocumentKind.Sale));
}
