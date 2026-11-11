using System.Text.Json;

namespace Application.Interfaces;

/// <summary>Server-only access to the TabaPay create, verify and authenticated notification contracts.</summary>
public interface ITabaPayGateway
{
    bool Configured { get; }
    bool Sandbox { get; }
    Uri? StorefrontOrigin { get; }
    Task<string> CreateAsync(long amountRial, Guid attemptId, string locale, CancellationToken ct);
    Uri PaymentUrl(string token);
    Task<TabaPayEvidence> VerifyAsync(string token, long amountRial, CancellationToken ct);
    TabaPayEvidence ReadNotification(string? authorize, JsonElement body);
}

/// <summary>Provider evidence with no card information or raw provider payload.</summary>
public sealed record TabaPayEvidence(string Token, long AmountRial, TabaPayDecision Decision, string? Reference = null);

public enum TabaPayDecision { Pending, Failed, Verified }
