using Domain.Accounting;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Persistence;

namespace Application.Accounting;

/// <summary>Bounded, restart-safe expiry/new-payment processing. Historical reconciliation is never automatic.</summary>
public sealed class AccountingWorker(IServiceScopeFactory scopes, TimeProvider time, ILogger<AccountingWorker> logger) : BackgroundService
{
    /// <summary>Processes at most 100 expired holds and 25 new verified payments per minute.</summary>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var state = await db.AccountingStates.AsNoTracking().SingleOrDefaultAsync(stoppingToken);
                if (state is { Activated: true, ActivatedAtUtc: not null })
                {
                    DateTime now = time.GetUtcNow().UtcDateTime;
                    var expired = await db.StockReservations.AsNoTracking().Where(x => x.Status == ReservationStatus.Active && x.ExpiresAtUtc <= now)
                        .OrderBy(x => x.ExpiresAtUtc).Select(x => x.Id).Take(100).ToListAsync(stoppingToken);
                    foreach (Guid id in expired) await DispatchAsync(new InventoryCommands.Expire(id), stoppingToken);
                    var payments = await db.PaymentTransactions.AsNoTracking().Where(x => x.Status == PaymentStatus.Verified
                        && x.VerifiedAtUtc != null && x.VerificationEvidenceDigest != null && x.Order.CreatedAtUtc >= state.ActivatedAtUtc
                        && !db.Settlements.Any(s => s.PaymentTransactionId == x.Id)).OrderBy(x => x.CreatedAtUtc)
                        .Select(x => x.Id).Take(25).ToListAsync(stoppingToken);
                    foreach (Guid id in payments) await DispatchAsync(new CommercePosting.FinalizeVerifiedPayment(id), stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception) { logger.LogWarning("Accounting background batch deferred; no gateway verification was performed."); }
            try { await Task.Delay(TimeSpan.FromMinutes(1), time, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }

    /// <summary>Uses a fresh context for every atomic command, avoiding stale tracking across a batch.</summary>
    private async Task DispatchAsync(object command, CancellationToken ct)
    {
        try
        {
            using var scope = scopes.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ISender>().Send(command, ct);
        }
        catch (AccountingException error) { logger.LogWarning("Accounting operation deferred: {Code}", error.Code); }
    }
}
