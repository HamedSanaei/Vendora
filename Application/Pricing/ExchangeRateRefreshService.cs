using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Persistence;

namespace Application.Pricing;

/// <summary>Schedules one durable rate refresh every 30 minutes, independently of visitor traffic.</summary>
public sealed class ExchangeRateRefreshService(IServiceScopeFactory scopes, TimeProvider time,
    ILogger<ExchangeRateRefreshService> logger) : BackgroundService
{
    /// <inheritdoc />
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            TimeSpan delay = RefreshExchangeRate.Interval;
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<ISender>()
                    .Send(new RefreshExchangeRate.Command(), stoppingToken);
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                DateTime next = await db.UsdtExchangeRates.AsNoTracking()
                    .Select(rate => rate.NextRefreshAtUtc).SingleAsync(stoppingToken);
                delay = next - time.GetUtcNow().UtcDateTime;
                if (delay < TimeSpan.FromSeconds(1)) delay = TimeSpan.FromSeconds(1);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
            catch (Exception exception)
            {
                logger.LogError("Scheduled USDT refresh failed ({ErrorType}); retrying on the next 30-minute interval.", exception.GetType().Name);
            }

            try { await Task.Delay(delay, time, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { return; }
        }
    }
}
