using Application.Interfaces;
using Domain.Entities;

namespace Application.Sms;

/// <summary>Purpose-specific branded messages matching the submitted ParsGreen white-text patterns.</summary>
public static class SmsCodeTemplates
{
    public const string Domain = "vendorashop.ir";
    public static readonly IReadOnlyDictionary<SmsCodePurpose, string> Texts = new Dictionary<SmsCodePurpose, string>
    {
        [SmsCodePurpose.Login] = "کد ورود شما به وندوراشاپ: {code}",
        [SmsCodePurpose.Registration] = "کد ثبت‌نام شما در وندوراشاپ: {code}",
        [SmsCodePurpose.PhoneVerification] = "کد تأیید شماره همراه شما در وندوراشاپ: {code}",
        [SmsCodePurpose.Recovery] = "کد بازیابی رمز عبور شما در وندوراشاپ: {code}",
        [SmsCodePurpose.Test] = "کد آزمایشی پیامک وندوراشاپ: {code}"
    };

    /// <summary>Formats one ASCII six-digit code twice; the final origin-bound line must not receive a footer.</summary>
    public static string Render(SmsCodePurpose purpose, string code)
    {
        if (code.Length != 6 || !code.All(char.IsAsciiDigit) || !Texts.TryGetValue(purpose, out var text))
            throw new ArgumentException("Invalid OTP purpose or code.");
        return text.Replace("{code}", code) + "\n\n@" + Domain + " #" + code;
    }

    /// <summary>Requires explicit opt-in and branded capability only for ParsGreen; other providers keep their existing templates.</summary>
    public static bool UsesBranded(SmsSettings policy, ISmsGateway gateway) => policy.ParsGreenBrandedOtp && gateway.Id == "ParsGreen";

    /// <summary>Checks the selected mode without silently falling back to a different template or provider.</summary>
    public static bool IsConfigured(SmsSettings policy, ISmsGateway gateway) => UsesBranded(policy, gateway) ? gateway.BrandedOtpConfigured : gateway.OtpConfigured;

    /// <summary>Dispatches a purpose-bound code through the explicitly selected mode; no retry or plaintext persistence occurs here.</summary>
    public static Task<string?> SendAsync(SmsSettings policy, ISmsGateway gateway, string phone, SmsCodePurpose purpose, CancellationToken ct)
        => UsesBranded(policy, gateway) ? gateway.SendBrandedCodeAsync(phone, purpose, ct) : gateway.SendCodeAsync(phone, policy.OtpType, policy.PatternId, ct);
}
