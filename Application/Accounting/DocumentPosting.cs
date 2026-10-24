using Domain.Accounting;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

/// <summary>Posts a validated draft's financial and inventory effects within the caller's transaction.</summary>
public sealed class DocumentPosting(AppDbContext db, InventoryPosting inventory, TimeProvider time)
{
    /// <summary>Captures costs and original-line returns, records the party balance, and freezes the document.</summary>
    public async Task PostAsync(FinancialDocument doc, Guid actor, CancellationToken ct, bool consumeOrderReservation = false)
    {
        if (doc.Status != DocumentStatus.Draft) throw new AccountingException("DOCUMENT_NOT_DRAFT");
        if (doc.Kind == DocumentKind.Proforma) { doc.Post(time.GetUtcNow().UtcDateTime); return; }
        FinancialDocument? original = null;
        if (doc.OriginalDocumentId.HasValue)
        {
            original = await db.FinancialDocuments.Include(x => x.Lines).SingleOrDefaultAsync(x => x.Id == doc.OriginalDocumentId, ct);
            var expected = doc.Kind == DocumentKind.PurchaseReturn ? DocumentKind.Purchase : DocumentKind.Sale;
            if (original is null || original.Kind != expected || original.Status != DocumentStatus.Posted ||
                original.CounterpartyId != doc.CounterpartyId || original.Currency != doc.Currency || original.ExchangeRate != doc.ExchangeRate)
                throw new AccountingException("INVALID_RETURN_SOURCE");
            var priorFreights = await db.FinancialDocuments.AsNoTracking().Where(x => x.OriginalDocumentId == original.Id && x.Status == DocumentStatus.Posted)
                .Select(x => x.Freight).ToListAsync(ct);
            if (doc.Freight > original.Freight - priorFreights.Sum()) throw new AccountingException("RETURN_FREIGHT_EXCEEDS_ORIGINAL", 400);
        }
        decimal freightRemaining = doc.Freight * doc.ExchangeRate;
        var ordered = doc.Lines.OrderBy(x => x.Id).ToList();
        for (int i = 0; i < ordered.Count; i++)
        {
            var line = ordered[i];
            var balance = await inventory.BalanceAsync(line.ProductId, ct);
            int delta; decimal value; decimal? difference = null; Guid? reverses = null;
            switch (doc.Kind)
            {
                case DocumentKind.Purchase:
                    if (doc.Net <= 0 && doc.Freight > 0) throw new AccountingException("FREIGHT_REQUIRES_POSITIVE_NET", 400);
                    decimal freight = i == ordered.Count - 1 ? freightRemaining
                        : decimal.Round(doc.Freight * doc.ExchangeRate * (doc.Net == 0 ? 0 : line.Net / doc.Net), 8, MidpointRounding.AwayFromZero);
                    freightRemaining -= freight;
                    value = (line.Net + (doc.PurchaseTaxRecoverable ? 0 : line.Tax)) * doc.ExchangeRate + freight;
                    balance.Receive(line.Quantity, value); delta = line.Quantity;
                    break;
                case DocumentKind.Sale:
                    value = -balance.Issue(line.Quantity, consumeOrderReservation); delta = -line.Quantity;
                    break;
                default:
                    var sourceLine = original!.Lines.SingleOrDefault(x => x.Id == line.OriginalLineId);
                    if (sourceLine is null || sourceLine.ProductId != line.ProductId) throw new AccountingException("INVALID_RETURN_LINE");
                    var prior = await db.FinancialDocumentLines.AsNoTracking().Where(x => x.OriginalLineId == sourceLine.Id
                        && db.FinancialDocuments.Any(d => d.Id == x.DocumentId && d.Status == DocumentStatus.Posted)).ToListAsync(ct);
                    int previousQuantity = prior.Sum(x => x.Quantity);
                    int currentQuantity = doc.Lines.Where(x => x.OriginalLineId == sourceLine.Id).Sum(x => x.Quantity);
                    if (previousQuantity + currentQuantity > sourceLine.Quantity) throw new AccountingException("RETURN_EXCEEDS_ORIGINAL_QUANTITY");
                    decimal expectedDiscount = sourceLine.Discount * line.Quantity / sourceLine.Quantity;
                    decimal expectedTax = sourceLine.Tax * line.Quantity / sourceLine.Quantity;
                    if (line.UnitPrice != sourceLine.UnitPrice || line.Discount != expectedDiscount || line.Tax != expectedTax)
                        throw new AccountingException("RETURN_PRICE_MUST_MATCH_ORIGINAL");
                    reverses = await db.StockMovements.Where(x => x.SourceKey == $"document:{original.Id}:{sourceLine.Id}")
                        .Select(x => (Guid?)x.Id).SingleOrDefaultAsync(ct);
                    if (doc.Kind == DocumentKind.SalesReturn)
                    {
                        // Unknown historical cost must never be silently replaced with zero/current cost.
                        if (!sourceLine.CostToman.HasValue) throw new AccountingException("ORIGINAL_COST_UNKNOWN");
                        value = previousQuantity + line.Quantity == sourceLine.Quantity
                            ? sourceLine.CostToman.Value - prior.Sum(x => x.CostToman ?? 0)
                            : decimal.Round(sourceLine.CostToman.Value * line.Quantity / sourceLine.Quantity, 8, MidpointRounding.AwayFromZero);
                        balance.Receive(line.Quantity, value); delta = line.Quantity;
                    }
                    else
                    {
                        value = -balance.Issue(line.Quantity); delta = -line.Quantity;
                        difference = (line.Net + (original.PurchaseTaxRecoverable ? 0 : line.Tax)) * doc.ExchangeRate + value;
                    }
                    break;
            }
            line.RecordCost(Math.Abs(value), difference);
            StockMovementKind movementKind = doc.Kind switch { DocumentKind.Purchase => StockMovementKind.Purchase,
                DocumentKind.Sale => StockMovementKind.Sale, DocumentKind.PurchaseReturn => StockMovementKind.PurchaseReturn,
                _ => StockMovementKind.SalesReturn };
            await inventory.RecordAsync(balance, $"document:{doc.Id}:{line.Id}", movementKind, delta,
                consumeOrderReservation && doc.Kind == DocumentKind.Sale ? -line.Quantity : 0, value, actor, doc.Number, ct, reverses);
        }
        int sign = doc.Kind is DocumentKind.Sale or DocumentKind.PurchaseReturn ? 1 : -1;
        db.PartyLedgerEntries.Add(new PartyLedgerEntry { CounterpartyId = doc.CounterpartyId, DocumentId = doc.Id,
            SourceKey = $"document:{doc.Id}", AmountToman = sign * doc.TotalToman, ActorId = actor, PostedAtUtc = time.GetUtcNow().UtcDateTime });
        doc.Post(time.GetUtcNow().UtcDateTime);
    }
}
