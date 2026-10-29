namespace Application.Interfaces;

/// <summary>Provider-neutral OTP delivery boundary; the returned code must never reach an API response or log.</summary>
public interface IPhoneCodeSender
{
    bool IsConfigured { get; }
    /// <summary>Checks the selected persisted mode before reserving a send budget; legacy adapters retain their synchronous readiness.</summary>
    Task<bool> IsConfiguredAsync(CancellationToken ct) => Task.FromResult(IsConfigured);
    /// <summary>Sends an OTP to the stored account phone, returning its value only to the hashing application handler.</summary>
    Task<string?> SendAsync(string phone, CancellationToken ct);
}
