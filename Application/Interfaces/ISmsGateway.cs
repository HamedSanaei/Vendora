namespace Application.Interfaces;

/// <summary>Safe provider result: accepted is not delivered; unknown must never trigger a blind resend.</summary>
public sealed record SmsGatewayResult(string Status, string? ProviderId = null, string? ErrorCode = null, bool Retryable = false);

/// <summary>Read-only delivery capability with server-only credentials. The OTP is returned only for hashing, never to HTTP clients.</summary>
public interface ISmsGateway
{
    string Id { get; }
    bool OtpConfigured { get; }
    bool TextConfigured { get; }
    bool DeliveryConfigured => false;
    /// <summary>Maximum service-message length accepted by this provider; existing adapters retain their current bound.</summary>
    int MaxTextLength => 3000;
    Task<string?> SendCodeAsync(string phone, int otpType, int patternId, CancellationToken ct);
    Task<SmsGatewayResult> SendTextAsync(string phone, string text, CancellationToken ct);
    Task<SmsGatewayResult> DeliveryAsync(string providerId, CancellationToken ct);
}
