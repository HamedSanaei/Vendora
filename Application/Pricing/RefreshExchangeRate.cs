using Application.Interfaces;
using Domain.Pricing;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Persistence;

namespace Application.Pricing;

/// <summary>Claims one refresh per 30 minutes and publishes the rate and derived prices atomically.</summary>
public static class RefreshExchangeRate
{
    public static readonly TimeSpan Interval = TimeSpan.FromMinutes(30);

    /// <summary>Background-only command; no public endpoint can force exchange polling.</summary>
    public sealed record Command : IRequest;

    /// <summary>Refreshes public quotes with no retries and preserves the last good rate on failure.</summary>
    public sealed class Handler(AppDbContext db, IEnumerable<IUsdtRateSource> sources,
        ILogger<Handler> logger, TimeProvider time) : IRequestHandler<Command>
    {
        /// <inheritdoc />
        public async Task Handle(Command request, CancellationToken cancellationToken)
        {
            var now = time.GetUtcNow().UtcDateTime;
            // This compare-and-set also prevents simultaneous hosts or restarts from polling early.
            int claimed = await db.UsdtExchangeRates.Where(rate => rate.Id == 1 && rate.NextRefreshAtUtc <= now)
                .ExecuteUpdateAsync(update => update
                    .SetProperty(rate => rate.LastAttemptAtUtc, now)
                    .SetProperty(rate => rate.NextRefreshAtUtc, now.Add(Interval)), cancellationToken);
            if (claimed == 0) return;

            var results = await Task.WhenAll(sources.Select(source => ReadSafelyAsync(source, cancellationToken)));
            var accepted = SelectConsistentQuotes(results.OfType<UsdtRateQuote>().ToArray());
            if (accepted.Count == 0)
            {
                await db.UsdtExchangeRates.Where(rate => rate.Id == 1).ExecuteUpdateAsync(update => update
                    .SetProperty(rate => rate.LastError, "No consistent public exchange quotes were available. Last good rate retained."), cancellationToken);
                logger.LogWarning("USDT rate refresh failed; internal rate retained until the next 30-minute attempt.");
                return;
            }

            var value = Median(accepted.Select(quote => quote.TomanPerUsdt).ToArray());
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var current = await db.UsdtExchangeRates.SingleAsync(cancellationToken);
            current.TomanPerUsdt = value;
            current.UpdatedAtUtc = now;
            current.Sources = string.Join(", ", accepted.Select(quote => quote.Source));
            current.LastError = null;

            var products = await db.Products.Where(product => product.UsdPrice != null).ToListAsync(cancellationToken);
            foreach (var product in products) product.SetPricing(0, product.UsdPrice, value);
            await db.SaveChangesAsync(cancellationToken);
            // Cart snapshots are refreshed in the same transaction; existing orders are never touched.
            await db.CartItems.Where(item => db.Products.Any(product => product.Id == item.ProductId && product.UsdPrice != null))
                .ExecuteUpdateAsync(update => update.SetProperty(item => item.UnitPrice,
                    item => db.Products.Where(product => product.Id == item.ProductId).Select(product => product.Price).First()), cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            logger.LogInformation("Internal USDT rate refreshed from {Sources}; {Count} dollar products repriced.", current.Sources, products.Count);
        }

        /// <summary>Isolates a failed provider so other public rate sources can still succeed.</summary>
        private async Task<UsdtRateQuote?> ReadSafelyAsync(IUsdtRateSource source, CancellationToken cancellationToken)
        {
            try { return await source.ReadAsync(cancellationToken); }
            catch (Exception exception) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning("USDT provider {Source} unavailable ({ErrorType}).", source.Name, exception.GetType().Name);
                return null;
            }
        }

        /// <summary>Rejects invalid values and quotes over 10% from the median, including disagreeing pairs.</summary>
        public static IReadOnlyList<UsdtRateQuote> SelectConsistentQuotes(IReadOnlyList<UsdtRateQuote> quotes)
        {
            var valid = quotes.Where(quote => quote.TomanPerUsdt > 0 && quote.TomanPerUsdt <= DollarPricing.MaximumExchangeRate)
                .GroupBy(quote => quote.Source).Select(group => group.First()).ToArray();
            if (valid.Length == 0) return [];
            decimal median = Median(valid.Select(quote => quote.TomanPerUsdt).ToArray());
            var consistent = valid.Where(quote => Math.Abs(quote.TomanPerUsdt - median) / median <= 0.10m).ToArray();
            return valid.Length > 1 && consistent.Length < 2 ? [] : consistent;
        }

        /// <summary>Returns the middle decimal rate, averaging the middle pair when necessary.</summary>
        private static decimal Median(decimal[] values)
        {
            Array.Sort(values);
            int middle = values.Length / 2;
            return values.Length % 2 == 0 ? (values[middle - 1] + values[middle]) / 2m : values[middle];
        }
    }
}
