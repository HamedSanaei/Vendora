using Domain.Accounting;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

public sealed record ProductProfitDto(Guid ProductId, int ProductCode, string Title, decimal NetSalesToman,
    decimal KnownCostToman, decimal KnownProfitToman, int UnknownCostLines);

/// <summary>Reports immutable sales snapshots; tax/freight are not merchandise revenue.</summary>
public static class AccountingReports
{
    public sealed record ProductProfit(DateTime? FromUtc = null, DateTime? ToUtc = null, int Page = 1) : IRequest<PageResult<ProductProfitDto>>;

    /// <summary>Aggregates decimal money for SQLite and distinguishes unknown historical costs.</summary>
    public sealed class ProductProfitHandler(AppDbContext db) : IRequestHandler<ProductProfit, PageResult<ProductProfitDto>>
    {
        public async Task<PageResult<ProductProfitDto>> Handle(ProductProfit request, CancellationToken ct)
        {
            int page = Math.Clamp(request.Page, 1, 100000);
            var docs = db.FinancialDocuments.AsNoTracking().Where(x => x.Status == DocumentStatus.Posted && (x.Kind == DocumentKind.Sale || x.Kind == DocumentKind.SalesReturn));
            if (request.FromUtc.HasValue) docs = docs.Where(x => x.IssuedAtUtc >= request.FromUtc);
            if (request.ToUtc.HasValue) docs = docs.Where(x => x.IssuedAtUtc <= request.ToUtc);
            var lines = await (from d in docs join l in db.FinancialDocumentLines.AsNoTracking() on d.Id equals l.DocumentId
                select new { l.ProductId, l.ProductCode, l.Title, l.Quantity, l.UnitPrice, l.Discount, l.CostToman, d.Kind, d.ExchangeRate }).ToListAsync(ct);
            var grouped = lines.GroupBy(x => x.ProductId).Select(group =>
            {
                decimal revenue = group.Sum(x => (x.Kind == DocumentKind.Sale ? 1 : -1) * (x.Quantity * x.UnitPrice - x.Discount) * x.ExchangeRate);
                decimal cost = group.Where(x => x.CostToman.HasValue).Sum(x => (x.Kind == DocumentKind.Sale ? 1 : -1) * x.CostToman!.Value);
                decimal knownRevenue = group.Where(x => x.CostToman.HasValue).Sum(x => (x.Kind == DocumentKind.Sale ? 1 : -1) * (x.Quantity * x.UnitPrice - x.Discount) * x.ExchangeRate);
                var row = group.First();
                return new ProductProfitDto(group.Key, row.ProductCode, row.Title, revenue, cost, knownRevenue - cost, group.Count(x => !x.CostToman.HasValue));
            }).OrderBy(x => x.ProductCode).ToList();
            return new(grouped.Skip((page - 1) * 25).Take(25).ToList(), page, 25, grouped.Count);
        }
    }
}
