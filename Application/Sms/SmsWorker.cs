using System.Text.Json;
using Application.Accounting;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Persistence;

namespace Application.Sms;

/// <summary>Runs bounded, durable messaging batches outside business transactions. Unknown acceptance is never resent.</summary>
public sealed class SmsWorker(IServiceScopeFactory scopes, TimeProvider time, ILogger<SmsWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var nextStockScan = DateTimeOffset.MinValue;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var processor = new SmsDispatch(scope.ServiceProvider.GetRequiredService<Persistence.AppDbContext>(),
                    scope.ServiceProvider.GetServices<ISmsGateway>(), time);
                await processor.ProcessAsync(stoppingToken);
                if (time.GetUtcNow() >= nextStockScan)
                {
                    await processor.LowStockAsync(stoppingToken);
                    nextStockScan = time.GetUtcNow().AddMinutes(1);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception) { logger.LogWarning("SMS batch deferred; no message content or provider response was logged."); }
            try { await Task.Delay(TimeSpan.FromSeconds(10), time, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}

/// <summary>Testable outbox dispatch with optimistic leases and no retry on ambiguous send results.</summary>
public sealed class SmsDispatch(AppDbContext db, IEnumerable<ISmsGateway> gateways, TimeProvider time)
{
    /// <summary>Claims each row atomically, commits before external I/O, and safely records bounded retries/delivery polling.</summary>
    public async Task ProcessAsync(CancellationToken ct)
    {
        DateTime now = time.GetUtcNow().UtcDateTime;
        var ids = await db.SmsMessages.AsNoTracking().Where(x => x.Status == "Queued" && x.NextAttemptAtUtc <= now ||
            x.Status == "Sending" && x.LeaseUntilUtc < now || x.Status == "Accepted" && x.ProviderId != null && x.NextAttemptAtUtc <= now && x.DeliveryChecks < 10)
            .OrderBy(x => x.CreatedAtUtc).Select(x => x.Id).Take(20).ToListAsync(ct);
        foreach (Guid id in ids)
        {
            await using (var tx = await db.Database.BeginTransactionAsync(ct))
            {
                await new AccountingUnitOfWork(db,time).AcquireGateAsync(ct);
                var row = await db.SmsMessages.SingleAsync(x => x.Id == id, ct);
                if (row.Status == "Sending")
                {
                    if (row.LeaseUntilUtc < now) { row.Status = "Unknown"; row.ErrorCode = "SEND_INTERRUPTED_ACCEPTANCE_UNKNOWN"; row.Version = Guid.NewGuid(); await db.SaveChangesAsync(ct); }
                    await tx.CommitAsync(ct); continue;
                }
                bool polling = row.Status == "Accepted";
                if ((!polling && row.Status != "Queued") || row.NextAttemptAtUtc > now) { await tx.CommitAsync(ct); continue; }
                var policy = await SmsPolicy.ReadAsync(db, ct);
                bool eventEnabled = !SmsPolicy.Templates.ContainsKey(row.Event) || SmsPolicy.Rules(policy).Any(x => x.Event == row.Event && x.Enabled);
                var user = row.UserId.HasValue ? await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == row.UserId, ct) : null;
                bool recipientValid = user is not null && (row.Event == "PhoneChanged" || user.PhoneNumberConfirmed && PhoneOwnership.Normalize(user.PhoneNumber ?? "") == row.Phone);
                if (row.Event.StartsWith("Admin")) recipientValid = recipientValid &&
                    await db.UserRoles.AnyAsync(x => x.UserId == row.UserId && db.Roles.Any(r => r.Id == x.RoleId && r.Name == "Admin"), ct) &&
                    (JsonSerializer.Deserialize<List<SmsRecipient>>(policy.RecipientsJson) ?? []).Any(x => x.UserId == row.UserId && x.Events.Contains(row.Event));
                if (!polling && (!policy.Enabled || !eventEnabled || !recipientValid))
                { row.Status = "Cancelled"; row.ErrorCode = "RECIPIENT_OR_EVENT_DISABLED"; row.Version = Guid.NewGuid(); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); continue; }
                row.Status = "Sending"; row.LeaseUntilUtc = now.AddMinutes(1); row.Version = Guid.NewGuid();
                if (!polling) row.Attempts++; else row.DeliveryChecks++;
                await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
                // The gate is released before any carrier I/O; its lease prevents parallel workers sending the same row.
                await tx.DisposeAsync();
                var gateway = gateways.SingleOrDefault(x => x.Id == row.Provider);
                SmsGatewayResult result;
                try { result = gateway is null ? new("Failed", ErrorCode: "SMS_PROVIDER_UNAVAILABLE") : polling
                    ? await gateway.DeliveryAsync(row.ProviderId!, ct) : await gateway.SendTextAsync(row.Phone, row.Body, ct); }
                catch (Exception e) when (e is HttpRequestException or TaskCanceledException) { result = new("Unknown", ErrorCode: "SMS_ACCEPTANCE_UNKNOWN"); }
                row.Status = result.Status is "Accepted" or "Delivered" or "Failed" or "Unknown" ? result.Status : "Unknown";
                row.ProviderId = result.ProviderId ?? row.ProviderId; row.ErrorCode = result.ErrorCode; row.LeaseUntilUtc = null; row.Version = Guid.NewGuid();
                row.NextAttemptAtUtc = time.GetUtcNow().UtcDateTime.AddMinutes(1);
                if (!polling && result.Status == "Failed" && result.Retryable && row.Attempts <= 3)
                { row.Status = "Queued"; row.NextAttemptAtUtc = time.GetUtcNow().UtcDateTime.AddMinutes(new[] { 1,5,15 }[row.Attempts-1]); }
                if (polling && row.DeliveryChecks >= 10 && row.Status == "Accepted") row.ErrorCode = "DELIVERY_UNCONFIRMED";
                await db.SaveChangesAsync(ct);
            }
        }
    }

    /// <summary>Detects crossings in real available stock; first activation/reconfiguration establishes a silent baseline.</summary>
    public async Task LowStockAsync(CancellationToken ct)
    {
        var policy = await SmsPolicy.ReadAsync(db, ct);
        if (!policy.Enabled || !SmsPolicy.Rules(policy).Any(x => x.Event == "AdminLowStock" && x.Enabled)) return;
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await new AccountingUnitOfWork(db,time).AcquireGateAsync(ct);
        var products = await db.Products.AsNoTracking().Where(x => x.Status == Domain.Enums.ProductStatus.Active).Select(x => new { x.Id, x.Title, x.StockQuantity }).ToListAsync(ct);
        var watches = await db.SmsStockWatches.ToDictionaryAsync(x => x.ProductId, ct);
        var events = new SmsNotifications(db,time);
        foreach (var product in products)
        {
            if (!watches.TryGetValue(product.Id, out var row)) { row = new() { ProductId = product.Id }; db.SmsStockWatches.Add(row); }
            bool baseline = row.SettingsVersion != policy.Version;
            if (!baseline && row.PreviousAvailable > policy.LowStockThreshold && product.StockQuantity <= policy.LowStockThreshold &&
                (row.LastAlertUtc is null || row.LastAlertUtc.Value.AddHours(24) <= time.GetUtcNow()))
            {
                await events.AdminsAsync("AdminLowStock", $"stock:{product.Id}:{time.GetUtcNow():yyyyMMdd}", new Dictionary<string,string> {
                    ["product"] = product.Title, ["quantity"] = product.StockQuantity.ToString(), ["link"] = await events.LinkAsync("admin/products/" + product.Id + "/edit", ct) }, ct);
                row.LastAlertUtc = time.GetUtcNow().UtcDateTime;
            }
            row.PreviousAvailable = product.StockQuantity; row.SettingsVersion = policy.Version;
        }
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
}
