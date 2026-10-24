using Domain.Accounting;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

/// <summary>Reverses unshipped accounting sales without fabricating a bank refund.</summary>
public sealed class OrderCancellation(AppDbContext db, AccountingUnitOfWork work, OrderReservations reservations, DocumentPosting posting, TimeProvider time)
{
    /// <summary>Releases pending reservations or returns remaining posted sale lines with their original cost.</summary>
    public async Task CancelAsync(Order order, Guid actor, CancellationToken ct)
    {
        await reservations.ReleaseAsync(order.Id, actor, ct);
        var sale = await db.FinancialDocuments.Include(x => x.Lines).SingleOrDefaultAsync(x => x.OrderId == order.Id
            && x.Kind == DocumentKind.Sale && x.Status == DocumentStatus.Posted, ct);
        if (sale is null) return;
        var priorReturns = await db.FinancialDocuments.AsNoTracking().Include(x => x.Lines).Where(x => x.OriginalDocumentId == sale.Id && x.Status == DocumentStatus.Posted).ToListAsync(ct);
        var remaining = sale.Lines.Select(line => new { Line = line, Quantity = line.Quantity - priorReturns.SelectMany(x => x.Lines)
            .Where(x => x.OriginalLineId == line.Id).Sum(x => x.Quantity) }).Where(x => x.Quantity > 0).ToList();
        if (remaining.Count == 0) return;
        if (remaining.Any(x => !x.Line.CostToman.HasValue)) throw new AccountingException("HISTORICAL_CANCELLATION_REQUIRES_COST_REVIEW");
        var credit = new FinancialDocument(await work.NextNumberAsync(DocumentKind.SalesReturn, ct), DocumentKind.SalesReturn,
            sale.Currency, sale.ExchangeRate, sale.CounterpartyId, actor, time.GetUtcNow().UtcDateTime, sale.Id,
            customerUserId: sale.CustomerUserId, orderId: order.Id);
        credit.SetDraftContent(remaining.Select(x => new FinancialDocumentLine(credit.Id, x.Line.ProductId, x.Line.ProductCode,
            x.Line.Title, x.Quantity, x.Line.UnitPrice, x.Line.Discount * x.Quantity / x.Line.Quantity, x.Line.Tax * x.Quantity / x.Line.Quantity, x.Line.Id)),
            sale.Freight - priorReturns.Sum(x => x.Freight), false, "Unshipped order cancellation; no automatic bank refund",
            sale.SellerSnapshotJson, sale.BuyerSnapshotJson);
        db.FinancialDocuments.Add(credit); await posting.PostAsync(credit, actor, ct);
    }
}
