using System.Globalization;
using System.Text.Json;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Sms;

/// <summary>Captures frozen notification rows inside the caller's business transaction; never performs HTTP.</summary>
public sealed class SmsNotifications(AppDbContext db, TimeProvider time)
{
    /// <summary>Queues a customer event for a currently verified phone, with an optional original destination for security alerts.</summary>
    public async Task CustomerAsync(string kind, string sourceKey, Guid userId, IReadOnlyDictionary<string,string>? values, CancellationToken ct, string? originalPhone = null, DateTime? occurredAtUtc = null)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, ct);
        if (user is null || (originalPhone is null && !user.PhoneNumberConfirmed)) return;
        string phone = PhoneOwnership.Normalize(originalPhone ?? user.PhoneNumber ?? "");
        if (phone.Length == 0) return;
        // Conflicting legacy ownership must suppress a notification, not roll back a paid order.
        if (originalPhone is null)
        {
            try { if (await PhoneOwnership.ResolveAsync(db, phone, ct) != userId) return; }
            catch (Application.Accounting.AccountingException) { return; }
        }
        await QueueAsync(kind, sourceKey, userId, phone, values, ct, occurredAtUtc);
    }

    /// <summary>Queues only selected managers who still hold Admin and own a confirmed phone.</summary>
    public async Task AdminsAsync(string kind, string sourceKey, IReadOnlyDictionary<string,string>? values, CancellationToken ct, DateTime? occurredAtUtc = null)
    {
        var settings = await SmsPolicy.ReadAsync(db, ct);
        foreach (var recipient in JsonSerializer.Deserialize<List<SmsRecipient>>(settings.RecipientsJson) ?? [])
        {
            if (!recipient.Events.Contains(kind)) continue;
            bool admin = await db.UserRoles.AnyAsync(x => x.UserId == recipient.UserId && db.Roles.Any(r => r.Id == x.RoleId && r.Name == "Admin"), ct);
            if (admin) await CustomerAsync(kind, sourceKey, recipient.UserId, values, ct, occurredAtUtc: occurredAtUtc);
        }
    }

    /// <summary>Constructs links exclusively from the configured storefront origin, excluding tokens and private ticket text.</summary>
    public async Task<string> LinkAsync(string path, CancellationToken ct)
    {
        var origin = await db.SeoSettings.AsNoTracking().Select(x => x.SiteUrl).SingleOrDefaultAsync(ct);
        return Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.Scheme == "https" && uri.UserInfo.Length == 0
            ? uri.GetLeftPart(UriPartial.Authority) + "/fa/" + path.TrimStart('/') : "";
    }

    /// <summary>Uses original order money and real verification evidence, not pending checkout or gateway query parameters.</summary>
    public async Task PaidAsync(Order order, bool review, CancellationToken ct)
    {
        var policy = await SmsPolicy.ReadAsync(db, ct);
        if (policy.ActivatedAtUtc is null || order.UserId is null) return;
        var payments = await db.PaymentTransactions.AsNoTracking().Where(x => x.OrderId == order.Id && x.Status == Domain.Enums.PaymentStatus.Verified && x.VerifiedAtUtc != null)
            .OrderByDescending(x => x.VerifiedAtUtc).ToListAsync(ct);
        var evidence = payments.FirstOrDefault(x => x.Amount == order.TotalAmount && x.Provider != Domain.Enums.PaymentProvider.Unknown &&
            x.VerificationEvidenceDigest?.Length == 64 && !string.IsNullOrWhiteSpace(x.ReferenceId) && !string.IsNullOrWhiteSpace(x.Authority) && !x.ReferenceId.StartsWith("TEST-") && !order.OrderNumber.StartsWith("ORD-SEED-"));
        if (evidence is null) return;
        var values = new Dictionary<string,string> { ["name"] = order.ShippingRecipientName, ["orderNumber"] = order.OrderNumber,
            ["amount"] = order.TotalAmount.ToString("N0", CultureInfo.InvariantCulture), ["link"] = await LinkAsync("order/" + order.OrderNumber, ct) };
        await CustomerAsync(review ? "PaymentReview" : "OrderPaid", "payment:" + order.Id, order.UserId!.Value, values, ct, occurredAtUtc: evidence.VerifiedAtUtc);
        values["link"] = await LinkAsync("admin/orders/" + order.Id, ct);
        await AdminsAsync(review ? "AdminPaymentReview" : "AdminOrderPaid", "payment-admin:" + order.Id, values, ct, evidence.VerifiedAtUtc);
    }

    /// <summary>Queues a real persisted shipping/delivery/cancellation transition exactly once per event and recipient.</summary>
    public async Task OrderStatusAsync(Order order, CancellationToken ct)
    {
        string? kind = order.Status switch { Domain.Enums.OrderStatus.Shipped => "OrderShipped", Domain.Enums.OrderStatus.Delivered => "OrderDelivered", Domain.Enums.OrderStatus.Cancelled => "OrderCancelled", _ => null };
        if (kind is null || order.UserId is null) return;
        var values = new Dictionary<string,string> { ["orderNumber"] = order.OrderNumber, ["link"] = await LinkAsync("order/" + order.OrderNumber, ct) };
        await CustomerAsync(kind, $"order-status:{order.Id}:{kind}", order.UserId.Value, values, ct);
    }

    /// <summary>Freezes the policy/template/provider once; uniqueness is enforced both locally and by the database.</summary>
    private async Task QueueAsync(string kind, string sourceKey, Guid userId, string phone, IReadOnlyDictionary<string,string>? values, CancellationToken ct, DateTime? occurredAtUtc)
    {
        var policy = await SmsPolicy.ReadAsync(db, ct);
        var rule = SmsPolicy.Rules(policy).SingleOrDefault(x => x.Event == kind && x.Enabled);
        if (!policy.Enabled || rule is null) return;
        if (occurredAtUtc.HasValue && occurredAtUtc < (rule.EnabledAtUtc ?? policy.ActivatedAtUtc)) return;
        string key = kind + ":" + sourceKey;
        if (db.SmsMessages.Local.Any(x => x.EventKey == key && x.Phone == phone) || await db.SmsMessages.AnyAsync(x => x.EventKey == key && x.Phone == phone, ct)) return;
        string body = rule.Template;
        foreach (string variable in new[] { "name", "orderNumber", "amount", "link", "product", "quantity" }) body = body.Replace("{" + variable + "}", values?.GetValueOrDefault(variable) ?? "");
        db.SmsMessages.Add(new() { Event = kind, EventKey = key, UserId = userId, Phone = phone, Body = body, Provider = policy.Provider,
            SettingsVersion = policy.Version, CreatedAtUtc = time.GetUtcNow().UtcDateTime, NextAttemptAtUtc = time.GetUtcNow().UtcDateTime });
    }
}
