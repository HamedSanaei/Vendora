using Application.Interfaces;
using Persistence;

namespace Application.Sms;

/// <summary>Compatibility port for the existing authenticated phone-confirmation endpoints.</summary>
public sealed class ConfiguredPhoneCodeSender(AppDbContext db, IEnumerable<ISmsGateway> gateways, TimeProvider time) : IPhoneCodeSender
{
    public bool IsConfigured => gateways.Any(x => x.OtpConfigured);

    /// <inheritdoc />
    public async Task<string?> SendAsync(string phone, CancellationToken ct)
    {
        var policy = await SmsPolicy.ReadAsync(db, ct);
        if (!policy.Enabled || !policy.PhoneVerification) return null;
        var code = await SmsPolicy.Gateway(policy, gateways).SendCodeAsync(phone, policy.OtpType, policy.PatternId, ct);
        var id = Guid.NewGuid();
        db.SmsMessages.Add(new() { Id = id, Event = "OtpVerification", EventKey = "otp-verification:" + id, Phone = phone, Body = "",
            Provider = policy.Provider, SettingsVersion = policy.Version, Status = code is null ? "Unknown" : "Accepted", Attempts = 1,
            ErrorCode = code is null ? "SMS_ACCEPTANCE_UNKNOWN" : null, CreatedAtUtc = time.GetUtcNow().UtcDateTime });
        await db.SaveChangesAsync(ct); return code;
    }
}
