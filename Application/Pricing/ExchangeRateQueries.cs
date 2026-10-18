using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Pricing;

/// <summary>Read-only views of the internal rate; never contacts an exchange.</summary>
public static class ExchangeRateQueries
{
    /// <summary>Admin preview metadata and health of the scheduled internal rate.</summary>
    public sealed record RateDto(decimal? TomanPerUsdt, DateTime? UpdatedAtUtc,
        DateTime NextRefreshAtUtc, string Sources, string? LastError, int RefreshIntervalMinutes = 30);

    /// <summary>Reads the current persisted rate without triggering a refresh.</summary>
    public sealed record Query : IRequest<RateDto>;

    /// <summary>Handles the read-only internal pricing rate query.</summary>
    public sealed class Handler(AppDbContext db) : IRequestHandler<Query, RateDto>
    {
        /// <inheritdoc />
        public async Task<RateDto> Handle(Query request, CancellationToken cancellationToken)
        {
            var rate = await db.UsdtExchangeRates.AsNoTracking().SingleAsync(cancellationToken);
            return new RateDto(rate.TomanPerUsdt, rate.UpdatedAtUtc, rate.NextRefreshAtUtc, rate.Sources, rate.LastError);
        }
    }
}
