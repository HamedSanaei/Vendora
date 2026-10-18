namespace Domain.Entities;

/// <summary>Durable internal pricing rate and refresh schedule shared by every application instance.</summary>
public sealed class UsdtExchangeRate
{
    /// <summary>The single shared USDT/Toman rate has key one.</summary>
    public int Id { get; set; } = 1;

    /// <summary>The last successfully validated rate, expressed in Toman per USDT.</summary>
    public decimal? TomanPerUsdt { get; set; }

    /// <summary>UTC timestamp of the last successful refresh.</summary>
    public DateTime? UpdatedAtUtc { get; set; }

    /// <summary>UTC timestamp of the most recent scheduled attempt.</summary>
    public DateTime? LastAttemptAtUtc { get; set; }

    /// <summary>Persisted claim prevents restart or multiple hosts from polling exchanges early.</summary>
    public DateTime NextRefreshAtUtc { get; set; } = DateTime.UnixEpoch;

    /// <summary>Names of the providers included in the internal rate.</summary>
    public string Sources { get; set; } = string.Empty;

    /// <summary>Safe operational status; never contains external response bodies or credentials.</summary>
    public string? LastError { get; set; }
}
