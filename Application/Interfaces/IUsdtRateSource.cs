namespace Application.Interfaces;

/// <summary>One public exchange rate normalized to Toman; no trading or account access is used.</summary>
public sealed record UsdtRateQuote(string Source, decimal TomanPerUsdt);

/// <summary>Reads a single bounded public market quote; invoked only by the scheduled refresh.</summary>
public interface IUsdtRateSource
{
    /// <summary>Provider identifier used for diagnostics and rate provenance.</summary>
    string Name { get; }

    /// <summary>Fetches a normalized quote, or null when this provider is unavailable.</summary>
    Task<UsdtRateQuote?> ReadAsync(CancellationToken cancellationToken);
}
