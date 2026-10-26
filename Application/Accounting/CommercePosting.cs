using System.Text.Json;
using System.Security.Cryptography;
using System.Text;
using Domain.Accounting;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

/// <summary>Internal verified-payment handoff, not an HTTP verification endpoint and not a gateway substitute.</summary>
public static class CommercePosting
{
    public static readonly Guid SystemActor = Guid.Parse("00000000-0000-0000-0000-000000000003");
    public sealed record FinalizeVerifiedPayment(Guid PaymentTransactionId, Guid? ReviewActor = null,
        string? ReviewedPreviewFingerprint = null, string? Confirmation = null) : IRequest<Guid>;

    /// <summary>Fingerprints immutable payment/order evidence for explicit historical review, without exposing the evidence itself.</summary>
    public static string PreviewFingerprint(PaymentTransaction payment) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(
        JsonSerializer.Serialize(new { payment.Id, payment.Amount, payment.Status, payment.Provider, payment.ReferenceId,
            payment.VerifiedAtUtc, payment.VerificationEvidenceDigest, payment.OrderId, payment.Order.OrderNumber,
            payment.Order.TotalAmount, payment.Order.ShippingMethodId, Lines = payment.Order.Items.OrderBy(x => x.Id).Select(x => new { x.Id, x.ProductId, x.Quantity, x.UnitPrice }) }))));

    /// <summary>Atomically posts real receipt/invoice/stock once, or holds real late funds for administrator review.</summary>
    public sealed class FinalizeHandler(AppDbContext db, AccountingUnitOfWork work, InventoryPosting inventory,
        OrderReservations reservations, DocumentPosting posting, TimeProvider time) : IRequestHandler<FinalizeVerifiedPayment, Guid>
    {
        public Task<Guid> Handle(FinalizeVerifiedPayment r, CancellationToken ct) => work.ExecuteAsync(r.ReviewActor ?? SystemActor,
            $"verified-payment:{r.PaymentTransactionId}", "verified-payment", r, async token =>
            {
                await work.RequireActiveAsync(token);
                var payment = await db.PaymentTransactions.Include(x => x.Order).ThenInclude(x => x.Items)
                    .SingleOrDefaultAsync(x => x.Id == r.PaymentTransactionId, token) ?? throw new AccountingException("PAYMENT_NOT_FOUND", 404);
                var order = payment.Order;
                if (payment.Status != PaymentStatus.Verified || !payment.VerifiedAtUtc.HasValue ||
                    payment.VerificationEvidenceDigest?.Length != 64 || payment.Provider == PaymentProvider.Unknown ||
                    string.IsNullOrWhiteSpace(payment.ReferenceId) || string.IsNullOrWhiteSpace(payment.Authority) ||
                    payment.ReferenceId.StartsWith("TEST-", StringComparison.OrdinalIgnoreCase) || order.OrderNumber.StartsWith("ORD-SEED-", StringComparison.OrdinalIgnoreCase))
                    throw new AccountingException("SERVER_VERIFICATION_EVIDENCE_REQUIRED");
                if (order.CurrencyCode != "TOMAN" || payment.Amount <= 0 || payment.Amount != order.TotalAmount ||
                    order.TotalAmount != order.Items.Sum(x => x.LineTotal) + order.ShippingCost - order.DiscountAmount ||
                    order.Subtotal != order.Items.Sum(x => x.LineTotal) || order.Subtotal <= 0 || order.ShippingCost < 0 ||
                    order.DiscountAmount < 0 || order.DiscountAmount > order.Subtotal ||
                    order.Items.Any(x => x.Quantity <= 0 || x.UnitPrice < 0) || order.Items.Count == 0 || !order.UserId.HasValue)
                    throw new AccountingException("PAYMENT_ORDER_AMOUNT_MISMATCH");
                var existing = await db.Settlements.SingleOrDefaultAsync(x => x.PaymentTransactionId == payment.Id, token);
                if (existing is not null) return existing.Id;
                var user = await db.Users.SingleOrDefaultAsync(x => x.Id == order.UserId, token)
                    ?? throw new AccountingException("ORDER_IDENTITY_REQUIRES_RECONCILIATION");
                var party = await db.Counterparties.SingleOrDefaultAsync(x => x.UserId == user.Id, token);
                if (party is null)
                {
                    party = new Counterparty { UserId = user.Id, Name = user.FullName, Phone = user.PhoneNumber ?? "", Role = CounterpartyRole.Customer };
                    db.Counterparties.Add(party);
                }
                var state = await db.AccountingStates.AsNoTracking().SingleAsync(token);
                bool historical = state.ActivatedAtUtc.HasValue && order.CreatedAtUtc < state.ActivatedAtUtc;
                if (historical && (r.ReviewActor is null || r.ReviewActor == Guid.Empty || r.Confirmation != "RECONCILE_VERIFIED_PAYMENT"
                    || r.ReviewedPreviewFingerprint != PreviewFingerprint(payment)))
                    throw new AccountingException("EXPLICIT_HISTORICAL_REVIEW_REQUIRED");
                var holds = await db.StockReservations.Where(x => x.OrderId == order.Id).ToListAsync(token);
                bool alreadyInvoiced = await db.FinancialDocuments.AnyAsync(x => x.OrderId == order.Id && x.Kind == DocumentKind.Sale && x.Status == DocumentStatus.Posted, token);
                bool hasLiveHold = !historical && holds.Count == order.Items.Count && holds.All(x => x.Status == ReservationStatus.Active && x.ExpiresAtUtc > time.GetUtcNow().UtcDateTime);
                bool canFulfil = !alreadyInvoiced && order.Status is not (OrderStatus.Cancelled or OrderStatus.Refunded);
                if (!historical && !hasLiveHold && !alreadyInvoiced)
                {
                    // Release any surviving old hold before the single serialized late-availability check.
                    await reservations.ReleaseAsync(order.Id, SystemActor, token);
                    foreach (var group in order.Items.GroupBy(x => x.ProductId))
                        if ((await inventory.BalanceAsync(group.Key, token)).Available < group.Sum(x => x.Quantity)) canFulfil = false;
                }
                var receipt = new Settlement { CounterpartyId = party.Id, Direction = SettlementDirection.Receipt,
                    Method = SettlementMethod.VerifiedGateway, AmountToman = payment.Amount, Reference = payment.ReferenceId,
                    PaymentTransactionId = payment.Id, OccurredAtUtc = payment.VerifiedAtUtc.Value, PostedAtUtc = time.GetUtcNow().UtcDateTime,
                    ActorId = SystemActor, RequiresReview = !canFulfil };
                db.Settlements.Add(receipt);
                db.PartyLedgerEntries.Add(new PartyLedgerEntry { CounterpartyId = party.Id, SettlementId = receipt.Id,
                    SourceKey = $"settlement:{receipt.Id}", AmountToman = -receipt.AmountToman, ActorId = SystemActor, PostedAtUtc = receipt.PostedAtUtc });
                if (!canFulfil)
                {
                    if (hasLiveHold) await reservations.ReleaseAsync(order.Id, SystemActor, token);
                    await new Application.Sms.SmsNotifications(db,time).PaidAsync(order, true, token);
                    return receipt.Id; // Genuine money remains unallocated; no fabricated sale/refund or negative stock.
                }
                var doc = new FinancialDocument(await work.NextNumberAsync(DocumentKind.Sale, token), DocumentKind.Sale,
                    DocumentCurrency.Toman, 1, party.Id, SystemActor, order.CreatedAtUtc, customerUserId: user.Id, orderId: order.Id);
                decimal remainingDiscount = order.DiscountAmount;
                var sourceItems = order.Items.OrderBy(x => x.Id).ToList();
                var products = await db.Products.Where(x => order.Items.Select(i => i.ProductId).Contains(x.Id)).ToDictionaryAsync(x => x.Id, token);
                var lines = new List<FinancialDocumentLine>();
                for (int i = 0; i < sourceItems.Count; i++)
                {
                    var item = sourceItems[i];
                    decimal part = item.DiscountSnapshot ?? (i == sourceItems.Count - 1 ? remainingDiscount : decimal.Floor(order.DiscountAmount * item.LineTotal / order.Subtotal));
                    remainingDiscount -= part;
                    lines.Add(new FinancialDocumentLine(doc.Id, item.ProductId, products[item.ProductId].ProductCode, item.ProductTitle, item.Quantity, item.UnitPrice, part, 0, baseUnitPrice: item.BaseUnitPrice, embeddedShippingUnitAmount: item.EmbeddedShippingUnitAmount));
                }
                doc.SetDraftContent(lines, order.ShippingCost, false, historical ? "Historical verified payment; original cost unknown" : "",
                    await DocumentCommands.SellerSnapshotAsync(db, token), JsonSerializer.Serialize(new PartySnapshot(order.ShippingRecipientName,
                        order.ShippingPhoneNumber, $"{order.ShippingProvince}، {order.ShippingCity}، {order.ShippingStreetAddress}، {order.ShippingPlaque}، {order.ShippingPostalCode}",
                        ShippingTerms: OrderShippingTerms(order))));
                db.FinancialDocuments.Add(doc);
                if (historical)
                {
                    doc.Post(time.GetUtcNow().UtcDateTime);
                    db.PartyLedgerEntries.Add(new PartyLedgerEntry { CounterpartyId = party.Id, DocumentId = doc.Id,
                        SourceKey = $"document:{doc.Id}", AmountToman = doc.TotalToman, ActorId = SystemActor, PostedAtUtc = receipt.PostedAtUtc });
                }
                else
                {
                    await posting.PostAsync(doc, SystemActor, token, hasLiveHold);
                    if (hasLiveHold) foreach (var hold in holds) { hold.Status = ReservationStatus.Consumed; hold.Version++; }
                }
                db.PaymentAllocations.Add(new PaymentAllocation { DocumentId = doc.Id, SettlementId = receipt.Id, AmountToman = receipt.AmountToman, PostedAtUtc = receipt.PostedAtUtc });
                order.PaymentStatus = PaymentStatus.Verified;
                if (order.Status == OrderStatus.PendingPayment) order.Status = OrderStatus.Paid;
                await new Application.Sms.SmsNotifications(db,time).PaidAsync(order, false, token);
                return receipt.Id;
            }, ct);
    }
    /// <summary>Uses original terms for historic documents and the immutable snapshot for new orders.</summary>
    private static string? OrderShippingTerms(Domain.Entities.Order order)
    {
        if (order.ShippingPolicySnapshotJson is not null)
        {
            using var snapshot = JsonDocument.Parse(order.ShippingPolicySnapshotJson);
            if (snapshot.RootElement.TryGetProperty("Terms", out var terms)) return terms.GetString();
        }
        return order.ShippingMethodId is null ? null : ProformaCommands.ShippingTerms(order.ShippingMethodId);
    }
}
