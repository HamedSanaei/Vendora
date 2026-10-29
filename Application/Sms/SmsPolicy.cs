using System.Text.Json;
using System.Text.RegularExpressions;
using Application.Accounting;
using Application.Auth;
using Application.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Sms;

public sealed record SmsRule(string Event, bool Enabled, string Template, DateTime? EnabledAtUtc = null);
public sealed record SmsRecipient(Guid UserId, string[] Events);
public sealed record SmsProviderView(string Id, bool Available, bool OtpConfigured, bool TextConfigured, bool DeliveryConfigured = false, bool BrandedOtpConfigured = false);
/// <summary>Read-only registered text preview with placeholders, never an actual generated code.</summary>
public sealed record SmsOtpTemplateView(string Purpose, string Text);
public sealed record SmsSettingsView(long Version, bool Enabled, string Provider, bool PhoneLogin, bool PasswordRecovery,
    bool PhoneVerification, int OtpType, int PatternId, int LowStockThreshold, IReadOnlyList<SmsRule> Rules,
    IReadOnlyList<SmsRecipient> Recipients, IReadOnlyList<SmsProviderView> Providers, IReadOnlyList<string> DuplicateVerifiedPhones)
{
    /// <summary>Null on legacy requests preserves the saved sending mode instead of silently disabling it.</summary>
    public bool? ParsGreenBrandedOtp { get; init; }
    public IReadOnlyList<SmsOtpTemplateView>? OtpTemplates { get; init; }
}

/// <summary>One provider-neutral policy and approved template vocabulary. All credentials stay in Infrastructure.</summary>
public static partial class SmsPolicy
{
    public static readonly IReadOnlyDictionary<string, string> LegacyTemplates = new Dictionary<string, string> {
        ["OrderPaid"] = "{name} عزیز، پرداخت سفارش {orderNumber} به مبلغ {amount} تومان تأیید شد. {link}",
        ["OrderShipped"] = "سفارش {orderNumber} ارسال شد. جزئیات و پیگیری: {link}",
        ["OrderDelivered"] = "سفارش {orderNumber} تحویل شد. سپاس از خرید شما. {link}",
        ["OrderCancelled"] = "سفارش {orderNumber} لغو شد. جزئیات: {link}",
        ["TicketReply"] = "پشتیبانی به تیکت شما پاسخ داد. مشاهده پاسخ: {link}",
        ["PasswordChanged"] = "رمز حساب وندورای شما تغییر کرد. اگر شما نبوده‌اید با پشتیبانی تماس بگیرید.",
        ["PhoneChanged"] = "شماره همراه حساب وندورای شما تغییر کرد. اگر شما نبوده‌اید با پشتیبانی تماس بگیرید.",
        ["PaymentReview"] = "پرداخت سفارش {orderNumber} دریافت شد؛ سفارش نیازمند بررسی پشتیبانی است. {link}",
        ["AdminOrderPaid"] = "سفارش پرداخت‌شده جدید: {orderNumber}، مبلغ {amount} تومان. {link}",
        ["AdminTicketNew"] = "تیکت پشتیبانی جدید ثبت شد. {link}",
        ["AdminTicketReply"] = "مشتری به تیکت پشتیبانی پاسخ داد. {link}",
        ["AdminLowStock"] = "موجودی قابل‌فروش {product} کم است: {quantity} عدد. {link}",
        ["AdminPaymentReview"] = "پرداخت سفارش {orderNumber} دریافت شده اما نیازمند بررسی دستی است. {link}"
    };

    public static readonly IReadOnlyDictionary<string, string> Templates = LegacyTemplates.ToDictionary(pair => pair.Key, pair => "وندوراشاپ\n" + (pair.Key switch
    {
        "PasswordChanged" => "رمز عبور حساب شما تغییر کرد. اگر شما نبوده‌اید با پشتیبانی تماس بگیرید.",
        "PhoneChanged" => "شماره همراه حساب شما تغییر کرد. اگر شما نبوده‌اید با پشتیبانی تماس بگیرید.",
        _ => pair.Value
    }));

    /// <summary>Reads safe defaults without writing or activating automatic messages.</summary>
    public static async Task<SmsSettings> ReadAsync(AppDbContext db, CancellationToken ct) =>
        await db.SmsSettings.AsNoTracking().SingleOrDefaultAsync(x => x.Id == 1, ct) ?? new SmsSettings();

    /// <summary>Returns every known event once, defaulting newly introduced events to disabled.</summary>
    public static IReadOnlyList<SmsRule> Rules(SmsSettings value)
    {
        var saved = JsonSerializer.Deserialize<List<SmsRule>>(value.RulesJson) ?? [];
        return Templates.Select(pair => {
            var rule = saved.SingleOrDefault(x => x.Event == pair.Key);
            // Upgrade only exact former defaults; customized text, activation dates and queued snapshots remain intact.
            return rule is null ? new(pair.Key, false, pair.Value) : rule.Template == LegacyTemplates[pair.Key] ? rule with { Template = pair.Value } : rule;
        }).ToList();
    }

    /// <summary>Normalizes phone assertions before comparison, never accepting a partial/foreign number.</summary>
    public static string Phone(string? input)
    {
        var number = CustomerProfile.NormalizeDigits(input ?? "").Replace(" ", "").Replace("-", "");
        if (number.StartsWith("+98")) number = "0" + number[3..];
        else if (number.StartsWith("0098")) number = "0" + number[4..];
        if (!CustomerProfile.ValidPhone(number)) throw new AccountingException("INVALID_PHONE", 400);
        return number;
    }

    /// <summary>Returns only enabled, actually installed gateways; no runtime URLs or paid/hidden fallback.</summary>
    public static ISmsGateway Gateway(SmsSettings policy, IEnumerable<ISmsGateway> gateways)
        => gateways.SingleOrDefault(x => x.Id == policy.Provider) ?? throw new AccountingException("SMS_PROVIDER_UNAVAILABLE", 503);

    /// <summary>Masks recipients in management responses and never exposes OTPs.</summary>
    public static string Mask(string phone) => phone.Length >= 7 ? phone[..4] + "***" + phone[^3..] : "***";

    /// <summary>Prevents unsupported variables, unbounded bodies and accidental OTP exposure in general templates.</summary>
    public static void ValidateRules(IReadOnlyList<SmsRule> rules)
    {
        if (rules.Count > Templates.Count || rules.Select(x => x.Event).Distinct().Count() != rules.Count) throw new AccountingException("SMS_INVALID_RULES", 400);
        foreach (var rule in rules)
            if (!Templates.ContainsKey(rule.Event) || string.IsNullOrWhiteSpace(rule.Template) || rule.Template.Length > 1000 ||
                Variables().Matches(rule.Template).Any(m => !new[] { "name", "orderNumber", "amount", "link", "product", "quantity" }.Contains(m.Groups[1].Value)))
                throw new AccountingException("SMS_INVALID_TEMPLATE", 400);
    }

    [GeneratedRegex("\\{([^{}]+)\\}")]
    private static partial Regex Variables();
}

/// <summary>Durable per-number budget shared by sign-in, reset, test and profile confirmation.</summary>
public static class SmsBudget
{
    /// <summary>Reserves a send slot. Call SaveChanges before contacting the gateway and handle concurrency conflicts.</summary>
    public static async Task<int> SpendAsync(AppDbContext db, string phone, DateTime now, CancellationToken ct)
    {
        var row = await db.SmsPhoneBudgets.SingleOrDefaultAsync(x => x.Phone == phone, ct);
        if (row is null) { row = new() { Phone = phone, WindowStartUtc = now }; db.SmsPhoneBudgets.Add(row); }
        if (row.NextSendAtUtc > now) return (int)Math.Ceiling((row.NextSendAtUtc - now).TotalSeconds);
        if (row.WindowStartUtc.AddMinutes(30) <= now) { row.WindowStartUtc = now; row.Count = 0; }
        if (row.Count >= 5) return Math.Max(1, (int)Math.Ceiling((row.WindowStartUtc.AddMinutes(30) - now).TotalSeconds));
        row.Count++; row.NextSendAtUtc = now.AddSeconds(120); row.Version = Guid.NewGuid(); return 0;
    }
}

/// <summary>Verified ownership is unique; unverified phone text can never silently attach another account.</summary>
public static class PhoneOwnership
{
    /// <summary>Resolves exactly one current verified owner, detecting conflicting legacy data without merging accounts.</summary>
    public static async Task<Guid?> ResolveAsync(AppDbContext db, string phone, CancellationToken ct)
    {
        var owners = await db.Users.AsNoTracking().Where(x => x.PhoneNumberConfirmed && x.PhoneNumber != null).Select(x => new { x.Id, x.PhoneNumber }).ToListAsync(ct);
        var ids = owners.Where(x => Normalize(x.PhoneNumber!) == phone).Select(x => x.Id).Distinct().ToList();
        var claim = await db.VerifiedPhoneIdentities.AsNoTracking().SingleOrDefaultAsync(x => x.Phone == phone, ct);
        if (ids.Count > 1 || (claim is not null && ids.Any(x => x != claim.UserId))) throw new AccountingException("PHONE_OWNERSHIP_CONFLICT", 409);
        return ids.Count == 1 ? ids[0] : null;
    }

    /// <summary>Claims a proven phone in the same transaction as its Identity confirmation flag.</summary>
    public static async Task ClaimAsync(AppDbContext db, Guid user, string phone, CancellationToken ct)
    {
        var owner = await ResolveAsync(db, phone, ct);
        if (owner.HasValue && owner != user) throw new AccountingException("PHONE_OWNERSHIP_CONFLICT", 409);
        var claimed = await db.VerifiedPhoneIdentities.SingleOrDefaultAsync(x => x.Phone == phone, ct);
        if (claimed is not null && claimed.UserId != user) throw new AccountingException("PHONE_OWNERSHIP_CONFLICT", 409);
        var row = await db.VerifiedPhoneIdentities.SingleOrDefaultAsync(x => x.UserId == user, ct);
        if (row is null) db.VerifiedPhoneIdentities.Add(new() { UserId = user, Phone = phone });
        else row.Phone = phone;
    }

    /// <summary>Safely compares legacy valid variants; malformed historical assertions do not become identities.</summary>
    public static string Normalize(string value) { try { return SmsPolicy.Phone(value); } catch (AccountingException) { return ""; } }
}
