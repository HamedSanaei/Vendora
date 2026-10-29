namespace Application.Interfaces;

/// <summary>Trusted server-selected SMS wording; ownership/security challenges retain their existing separate purposes.</summary>
public enum SmsCodePurpose { Login, Registration, PhoneVerification, Recovery, Test }

/// <summary>Safe provider result: accepted is not delivered; unknown must never trigger a blind resend.</summary>
public sealed record SmsGatewayResult(string Status, string? ProviderId = null, string? ErrorCode = null, bool Retryable = false);

/// <summary>Read-only delivery capability with server-only credentials. The OTP is returned only for hashing, never to HTTP clients.</summary>
public interface ISmsGateway
{
    string Id { get; }
    bool OtpConfigured { get; }
    bool TextConfigured { get; }
    bool DeliveryConfigured => false;
    bool BrandedOtpConfigured => false;
    /// <summary>Sends a branded purpose-specific code when supported; unsupported providers never fall back implicitly.</summary>
    Task<string?> SendBrandedCodeAsync(string phone, SmsCodePurpose purpose, CancellationToken ct) => Task.FromResult<string?>(null);
    /// <summary>Maximum service-message length accepted by this provider; existing adapters retain their current bound.</summary>
    int MaxTextLength => 3000;
    Task<string?> SendCodeAsync(string phone, int otpType, int patternId, CancellationToken ct);
    Task<SmsGatewayResult> SendTextAsync(string phone, string text, CancellationToken ct);
    Task<SmsGatewayResult> DeliveryAsync(string providerId, CancellationToken ct);
}
