using System.Security.Cryptography;
using System.Text.Json;
using Application.Accounting;
using Application.Auth;
using Application.Interfaces;
using Application.Sms;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Persistence;

namespace Application.Payments;

/// <summary>Creates, resumes and verifies TabaPay payments against authoritative Vendora orders.</summary>
public static class TabaPayPayments
{
    public sealed record Availability : IRequest<AvailabilityView>;
    public sealed record AvailabilityView(bool Available, bool Sandbox);
    public sealed record Start(Guid UserId, string OrderNumber, string Locale) : IRequest<StartView>;
    public sealed record StartView(string Url);
    public sealed record Read(Guid UserId, string OrderNumber) : IRequest<PaymentView>;
    public sealed record Recheck(Guid UserId, string OrderNumber, string Locale) : IRequest<PaymentView>;
    public sealed record PaymentView(string OrderNumber, decimal Amount, string State, bool CanRetry, string? Reference);
    public sealed record Callback(Guid AttemptId, string Locale, string? Token, string? Authorize = null, JsonElement? Notification = null)
        : IRequest<CallbackView>;
    public sealed record CallbackView(Uri Destination);

    public sealed class AvailabilityHandler(ITabaPayGateway gateway) : IRequestHandler<Availability, AvailabilityView>
    {
        public Task<AvailabilityView> Handle(Availability request, CancellationToken ct) =>
            Task.FromResult(new AvailabilityView(gateway.Configured, gateway.Configured && gateway.Sandbox));
    }

    /// <summary>Reserves an attempt under the shared write gate, then makes the remote request outside the transaction.</summary>
    public sealed class StartHandler(AppDbContext db, AccountingUnitOfWork work, ITabaPayGateway gateway, TimeProvider time)
        : IRequestHandler<Start, StartView>
    {
        public async Task<StartView> Handle(Start request, CancellationToken ct)
        {
            CheckLocale(request.Locale);
            if (!gateway.Configured) throw new AccountingException("PAYMENT_NOT_CONFIGURED", 503);
            if (!await CustomerProfile.IsCompleteAsync(db, request.UserId, ct))
                throw new AccountingException("PROFILE_INCOMPLETE", 409);
            var (attempt, existing) = await ClaimAsync(request, ct);
            if (existing) return new(gateway.PaymentUrl(attempt.Authority!).AbsoluteUri);

            string token;
            try { token = await gateway.CreateAsync(ToRial(attempt.Amount), attempt.Id, request.Locale, ct); }
            catch (AccountingException)
            {
                await SaveStartResultAsync(attempt.Id, null, ct);
                throw;
            }
            await SaveStartResultAsync(attempt.Id, token, ct);
            return new(gateway.PaymentUrl(token).AbsoluteUri);
        }

        private async Task<(PaymentTransaction Attempt, bool Existing)> ClaimAsync(Start request, CancellationToken ct)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            await work.AcquireGateAsync(ct);
            var order = await FindOrderAsync(db, request.UserId, request.OrderNumber, ct);
            if (order.CurrencyCode != "TOMAN" || !CanPay(order) ||
                await db.PaymentTransactions.AnyAsync(x => x.OrderId == order.Id && x.Status == PaymentStatus.Verified, ct))
                throw new AccountingException("ORDER_NOT_PAYABLE");
            _ = ToRial(order.TotalAmount);

            var last = await db.PaymentTransactions.Where(x => x.OrderId == order.Id && x.Provider == PaymentProvider.TabaPay)
                .OrderByDescending(x => x.CreatedAtUtc).FirstOrDefaultAsync(ct);
            if (last?.Status == PaymentStatus.Redirected && last.Authority is not null)
            {
                await transaction.CommitAsync(ct);
                return (last, true);
            }
            DateTime now = time.GetUtcNow().UtcDateTime;
            if (last?.Status == PaymentStatus.Pending)
            {
                if (last.CreatedAtUtc > now.AddSeconds(-30)) throw new AccountingException("PAYMENT_START_IN_PROGRESS", 409);
                last.Status = PaymentStatus.Failed;
                last.FailureReason = "PAYMENT_START_INTERRUPTED";
            }
            var attempt = new PaymentTransaction
            {
                OrderId = order.Id, Provider = PaymentProvider.TabaPay, Amount = order.TotalAmount,
                Status = PaymentStatus.Pending, CreatedAtUtc = now
            };
            db.PaymentTransactions.Add(attempt);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return (attempt, false);
        }

        private async Task SaveStartResultAsync(Guid attemptId, string? token, CancellationToken ct)
        {
            // A different process may have expired the claim while the network request was in flight.
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            await work.AcquireGateAsync(ct);
            var attempt = await db.PaymentTransactions.Include(x => x.Order).SingleAsync(x => x.Id == attemptId, ct);
            if (attempt.Status != PaymentStatus.Pending || !CanPay(attempt.Order) ||
                await db.PaymentTransactions.AnyAsync(x => x.OrderId == attempt.OrderId && x.Status == PaymentStatus.Verified, ct))
                throw new AccountingException("ORDER_NOT_PAYABLE");
            if (token is not null && await db.PaymentTransactions.AnyAsync(x => x.Provider == PaymentProvider.TabaPay && x.Authority == token, ct))
                throw new AccountingException("PAYMENT_TOKEN_ALREADY_USED", 502);
            attempt.Authority = token;
            attempt.Status = token is null ? PaymentStatus.Failed : PaymentStatus.Redirected;
            attempt.FailureReason = token is null ? "PAYMENT_START_FAILED" : null;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
    }

    /// <summary>Returns the signed-in owner's current order and payment state, including whether a retry is safe.</summary>
    public sealed class ReadHandler(AppDbContext db, ITabaPayGateway gateway) : IRequestHandler<Read, PaymentView>
    {
        public async Task<PaymentView> Handle(Read request, CancellationToken ct)
        {
            var order = await FindOrderAsync(db, request.UserId, request.OrderNumber, ct);
            var proofs = await db.PaymentTransactions.AsNoTracking().Where(x => x.OrderId == order.Id
                && x.Status == PaymentStatus.Verified && x.VerifiedAtUtc != null && x.VerificationEvidenceDigest != null)
                .OrderByDescending(x => x.VerifiedAtUtc).Take(2).ToListAsync(ct);
            var verified = proofs.FirstOrDefault();
            bool review = proofs.Count > 1 || (order.PaymentStatus == PaymentStatus.Verified && verified is null)
                || (verified is not null && (order.Status is OrderStatus.PendingPayment or OrderStatus.Cancelled or OrderStatus.Refunded
                    || await db.Settlements.AnyAsync(x => x.PaymentTransactionId == verified.Id && x.RequiresReview, ct)));
            var last = await db.PaymentTransactions.AsNoTracking().Where(x => x.OrderId == order.Id && x.Provider == PaymentProvider.TabaPay)
                .OrderByDescending(x => x.CreatedAtUtc).Select(x => (PaymentStatus?)x.Status).FirstOrDefaultAsync(ct);
            string state = review ? "review" : order.PaymentStatus == PaymentStatus.Verified ? "paid"
                : order.Status is OrderStatus.Cancelled or OrderStatus.Refunded ? "cancelled"
                : last == PaymentStatus.Failed ? "failed" : "pending";
            return new(order.OrderNumber, order.TotalAmount, state, gateway.Configured && verified is null && CanPay(order)
                && order.TotalAmount is >= 10_000m and <= 50_000_000m, verified?.ReferenceId);
        }
    }

    /// <summary>Lets the owner recover a missed callback without creating another transaction.</summary>
    public sealed class RecheckHandler(AppDbContext db, ISender sender) : IRequestHandler<Recheck, PaymentView>
    {
        public async Task<PaymentView> Handle(Recheck request, CancellationToken ct)
        {
            CheckLocale(request.Locale);
            var order = await FindOrderAsync(db, request.UserId, request.OrderNumber, ct);
            var attempt = await db.PaymentTransactions.AsNoTracking().Where(x => x.OrderId == order.Id
                && x.Provider == PaymentProvider.TabaPay && x.Authority != null)
                .OrderByDescending(x => x.CreatedAtUtc).FirstOrDefaultAsync(ct);
            if (attempt is not null && order.PaymentStatus != PaymentStatus.Verified)
                await sender.Send(new Callback(attempt.Id, request.Locale, attempt.Authority), ct);
            return await sender.Send(new Read(request.UserId, request.OrderNumber), ct);
        }
    }

    /// <summary>Accepts browser returns and authenticated provider notifications for one recorded attempt.</summary>
    public sealed class CallbackHandler(AppDbContext db, AccountingUnitOfWork work, ITabaPayGateway gateway,
        ISender sender, SmsNotifications notifications, TimeProvider time, ILogger<CallbackHandler> logger)
        : IRequestHandler<Callback, CallbackView>
    {
        public async Task<CallbackView> Handle(Callback request, CancellationToken ct)
        {
            CheckLocale(request.Locale);
            if (!gateway.Configured) throw new AccountingException("PAYMENT_NOT_CONFIGURED", 503);
            var evidence = request.Notification is { } body ? gateway.ReadNotification(request.Authorize, body) : null;
            string? token = evidence?.Token ?? request.Token;
            if (!Guid.TryParseExact(token, "D", out _)) throw new AccountingException("INVALID_PAYMENT_TOKEN", 400);
            var attempt = await db.PaymentTransactions.AsNoTracking().Include(x => x.Order).SingleOrDefaultAsync(
                x => x.Id == request.AttemptId && x.Provider == PaymentProvider.TabaPay && x.Authority == token, ct)
                ?? throw new AccountingException("PAYMENT_NOT_FOUND", 404);
            long amountRial = ToRial(attempt.Amount);
            var destination = new Uri(gateway.StorefrontOrigin!,
                $"/{request.Locale}/order/{Uri.EscapeDataString(attempt.Order.OrderNumber)}");

            if (evidence is null && attempt.VerifiedAtUtc is null)
            {
                try { evidence = await gateway.VerifyAsync(token!, amountRial, ct); }
                catch (AccountingException error) when (error.Status >= 500)
                {
                    logger.LogWarning("TabaPay verification deferred for attempt {AttemptId}: {Code}", attempt.Id, error.Code);
                    return new(destination);
                }
            }
            if (evidence is not null && (evidence.Token != token || evidence.AmountRial != amountRial))
                throw new AccountingException("PAYMENT_VERIFICATION_MISMATCH", 409);

            bool postAccounting = await PersistAsync(attempt.Id, evidence, ct);
            if (postAccounting)
            {
                // Persist evidence before posting. The existing accounting worker can recover a crash or ledger failure.
                db.ChangeTracker.Clear();
                try { await sender.Send(new CommercePosting.FinalizeVerifiedPayment(attempt.Id), ct); }
                catch (AccountingException error)
                {
                    logger.LogWarning("Verified TabaPay receipt queued for accounting: {Code}", error.Code);
                }
            }
            return new(destination);
        }

        private async Task<bool> PersistAsync(Guid id, TabaPayEvidence? evidence, CancellationToken ct)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            await work.AcquireGateAsync(ct);
            var payment = await db.PaymentTransactions.Include(x => x.Order).SingleAsync(x => x.Id == id, ct);
            var order = payment.Order;
            var accounting = await db.AccountingStates.AsNoTracking().SingleOrDefaultAsync(ct);
            if (payment.VerifiedAtUtc is null && evidence?.Decision == TabaPayDecision.Failed)
            {
                payment.Status = PaymentStatus.Failed;
                payment.FailureReason = "PAYMENT_NOT_COMPLETED";
            }
            if (evidence is { Decision: TabaPayDecision.Verified, Reference: not null })
            {
                if (order.CurrencyCode != "TOMAN" || payment.Amount != order.TotalAmount ||
                    payment.Authority != evidence.Token || ToRial(payment.Amount) != evidence.AmountRial)
                    throw new AccountingException("PAYMENT_ORDER_AMOUNT_MISMATCH");
                if (payment.VerifiedAtUtc.HasValue && payment.ReferenceId != evidence.Reference)
                    throw new AccountingException("PAYMENT_REFERENCE_CONFLICT");
                if (payment.VerifiedAtUtc is null)
                {
                    if (await db.PaymentTransactions.AnyAsync(x => x.Id != id && x.Provider == PaymentProvider.TabaPay
                        && x.ReferenceId == evidence.Reference && x.Status == PaymentStatus.Verified, ct))
                        throw new AccountingException("PAYMENT_REFERENCE_ALREADY_USED");
                    bool anotherPayment = await db.PaymentTransactions.AnyAsync(x => x.Id != id && x.OrderId == order.Id
                        && x.Status == PaymentStatus.Verified, ct);
                    string digest = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(
                        new { Provider = "TabaPay", evidence.Token, evidence.AmountRial, evidence.Reference })));
                    payment.RecordServerVerification(evidence.Reference, time.GetUtcNow().UtcDateTime, digest);
                    payment.FailureReason = null;
                    await db.SaveChangesAsync(ct);
                    if (accounting?.Activated != true)
                    {
                        // Before cutover, order creation has already deducted stock. Never deduct it a second time.
                        bool review = anotherPayment || !CanPay(order);
                        if (!review) { order.Status = OrderStatus.Paid; order.PaymentStatus = PaymentStatus.Verified; }
                        if (!gateway.Sandbox) await notifications.PaidAsync(order, review, ct);
                    }
                    else if (accounting.ActivatedAtUtc > order.CreatedAtUtc && !gateway.Sandbox)
                        await notifications.PaidAsync(order, true, ct);
                }
            }
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return payment.VerifiedAtUtc.HasValue && accounting is { Activated: true, ActivatedAtUtc: not null }
                && order.CreatedAtUtc >= accounting.ActivatedAtUtc;
        }
    }

    private static async Task<Order> FindOrderAsync(AppDbContext db, Guid owner, string number, CancellationToken ct) =>
        await db.Orders.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == owner && x.OrderNumber == number, ct)
        ?? throw new AccountingException("ORDER_NOT_FOUND", 404);

    private static bool CanPay(Order order) => order.Status == OrderStatus.PendingPayment &&
        order.PaymentStatus != PaymentStatus.Verified && !order.OrderNumber.StartsWith("ORD-SEED-", StringComparison.OrdinalIgnoreCase);

    private static void CheckLocale(string locale)
    {
        if (locale is not ("fa" or "en")) throw new AccountingException("INVALID_PAYMENT_LOCALE", 400);
    }

    private static long ToRial(decimal toman)
    {
        if (toman is < 10_000m or > 50_000_000m || decimal.Truncate(toman * 10) != toman * 10)
            throw new AccountingException("PAYMENT_AMOUNT_OUT_OF_RANGE", 400);
        return (long)(toman * 10);
    }
}
