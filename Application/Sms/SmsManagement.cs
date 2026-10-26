using System.Text.Json;
using Application.Accounting;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Sms;

/// <summary>Administrative settings, manual single-recipient messages and masked delivery history.</summary>
public static class SmsManagement
{
    public sealed record Read : IRequest<SmsSettingsView>;
    public sealed record Save(SmsSettingsView Input) : IRequest<SmsSettingsView>;
    public sealed record Send(Guid ActorId, Guid UserId, string Text, string Key, bool Test = false) : IRequest<Guid>;
    public sealed record History(int Page = 1, string? Status = null) : IRequest<object>;
    public sealed record Recipients : IRequest<object>;

    /// <summary>Reports only non-secret capabilities and legacy ownership conflicts.</summary>
    public sealed class ReadHandler(AppDbContext db, IEnumerable<ISmsGateway> gateways) : IRequestHandler<Read,SmsSettingsView>
    {
        public async Task<SmsSettingsView> Handle(Read request, CancellationToken ct)
        {
            var policy = await SmsPolicy.ReadAsync(db, ct);
            var phones = await db.Users.AsNoTracking().Where(x => x.PhoneNumberConfirmed && x.PhoneNumber != null).Select(x => new { x.Id, x.PhoneNumber }).ToListAsync(ct);
            var duplicates = phones.GroupBy(x => PhoneOwnership.Normalize(x.PhoneNumber!)).Where(x => x.Key.Length > 0 && x.Count() > 1)
                .Select(x => SmsPolicy.Mask(x.Key) + ": " + string.Join(", ", x.Select(u => u.Id))).ToList();
            return new(policy.Version, policy.Enabled, policy.Provider, policy.PhoneLogin, policy.PasswordRecovery, policy.PhoneVerification,
                policy.OtpType, policy.PatternId, policy.LowStockThreshold, SmsPolicy.Rules(policy), JsonSerializer.Deserialize<List<SmsRecipient>>(policy.RecipientsJson) ?? [],
                new[] { "ParsGreen", "Kavenegar" }.Select(id => { var gateway = gateways.SingleOrDefault(x => x.Id == id); return new SmsProviderView(id, gateway is not null, gateway?.OtpConfigured == true, gateway?.TextConfigured == true, gateway?.DeliveryConfigured == true); }).ToList(), duplicates);
        }
    }

    /// <summary>Validates recipients/templates before a versioned save; no credentials are accepted from the browser.</summary>
    public sealed class SaveHandler(AppDbContext db, IEnumerable<ISmsGateway> gateways, TimeProvider time) : IRequestHandler<Save,SmsSettingsView>
    {
        public async Task<SmsSettingsView> Handle(Save request, CancellationToken ct)
        {
            var input = request.Input;
            if (input.Rules is null || input.Recipients is null || input.Recipients.Count > 50 || input.OtpType is < 0 or > 20 || input.PatternId < 0 || input.LowStockThreshold is < 0 or > 100000)
                throw new AccountingException("SMS_INVALID_SETTINGS", 400);
            SmsPolicy.ValidateRules(input.Rules);
            var gateway = gateways.SingleOrDefault(x => x.Id == input.Provider) ?? throw new AccountingException("SMS_PROVIDER_UNAVAILABLE", 400);
            if (input.Enabled && ((input.PhoneLogin || input.PasswordRecovery || input.PhoneVerification) && !gateway.OtpConfigured || input.Rules.Any(x => x.Enabled) && !gateway.TextConfigured))
                throw new AccountingException("SMS_NOT_CONFIGURED", 400);
            var view = await new ReadHandler(db, gateways).Handle(new(), ct);
            if ((input.PhoneLogin || input.PasswordRecovery || input.Rules.Any(x => x.Enabled)) && view.DuplicateVerifiedPhones.Count > 0) throw new AccountingException("PHONE_OWNERSHIP_CONFLICT", 409);
            if (input.Recipients.Select(x => x.UserId).Distinct().Count() != input.Recipients.Count) throw new AccountingException("SMS_INVALID_RECIPIENT", 400);
            foreach (var recipient in input.Recipients)
                if (recipient.Events is null || recipient.Events.Any(x => !SmsPolicy.Templates.ContainsKey(x) || !x.StartsWith("Admin")) ||
                    !await db.Users.AnyAsync(x => x.Id == recipient.UserId && x.PhoneNumberConfirmed && x.PhoneNumber != null, ct) ||
                    !await db.UserRoles.AnyAsync(x => x.UserId == recipient.UserId && db.Roles.Any(r => r.Id == x.RoleId && r.Name == "Admin"), ct))
                    throw new AccountingException("SMS_INVALID_RECIPIENT", 400);
            var row = await db.SmsSettings.SingleOrDefaultAsync(x => x.Id == 1, ct);
            if ((row?.Version ?? 1) != input.Version) throw new AccountingException("SMS_SETTINGS_CHANGED");
            if (row is null) { row = new(); db.SmsSettings.Add(row); }
            row.Enabled = input.Enabled; row.Provider = input.Provider; row.PhoneLogin = input.PhoneLogin; row.PasswordRecovery = input.PasswordRecovery;
            row.PhoneVerification = input.PhoneVerification; row.OtpType = input.OtpType; row.PatternId = input.PatternId; row.LowStockThreshold = input.LowStockThreshold;
            var previousRules = SmsPolicy.Rules(row);
            row.RulesJson = JsonSerializer.Serialize(input.Rules.Select(rule => rule with { EnabledAtUtc = rule.Enabled
                ? previousRules.SingleOrDefault(x => x.Event == rule.Event && x.Enabled)?.EnabledAtUtc ?? time.GetUtcNow().UtcDateTime : null }));
            row.RecipientsJson = JsonSerializer.Serialize(input.Recipients); row.Version++;
            row.ActivatedAtUtc ??= time.GetUtcNow().UtcDateTime;
            try { await db.SaveChangesAsync(ct); } catch (DbUpdateException) { throw new AccountingException("SMS_SETTINGS_CHANGED"); }
            return await new ReadHandler(db, gateways).Handle(new(), ct);
        }
    }

    /// <summary>Queues an idempotent, authorized single-recipient service message; test destinations cannot be arbitrary numbers.</summary>
    public sealed class SendHandler(AppDbContext db, AccountingUnitOfWork work, IEnumerable<ISmsGateway> gateways, TimeProvider time) : IRequestHandler<Send,Guid>
    {
        public Task<Guid> Handle(Send request, CancellationToken ct) => work.ExecuteAsync(request.ActorId, request.Key, "sms-manual", request, async token => {
            var policy = await SmsPolicy.ReadAsync(db, token);
            if (!policy.Enabled || !SmsPolicy.Gateway(policy, gateways).TextConfigured) throw new AccountingException("SMS_NOT_CONFIGURED", 503);
            if (request.Test && request.UserId != request.ActorId) throw new AccountingException("SMS_TEST_OWN_PHONE_ONLY", 400);
            var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.UserId && x.PhoneNumberConfirmed, token) ?? throw new AccountingException("SMS_VERIFIED_RECIPIENT_REQUIRED", 400);
            if (await PhoneOwnership.ResolveAsync(db, SmsPolicy.Phone(user.PhoneNumber), token) != user.Id) throw new AccountingException("PHONE_OWNERSHIP_CONFLICT",409);
            string text = request.Test ? "این پیام برای آزمایش اتصال پیامک وندورا ارسال شده است." : request.Text.Trim();
            if (text.Length is < 1 or > 3000) throw new AccountingException("SMS_INVALID_TEXT", 400);
            var row = new SmsMessage { ActorId = request.ActorId, UserId = user.Id, Phone = SmsPolicy.Phone(user.PhoneNumber), Body = text,
                Event = request.Test ? "Test" : "Manual", EventKey = "manual:" + request.ActorId + ":" + request.Key, Provider = policy.Provider,
                SettingsVersion = policy.Version, CreatedAtUtc = time.GetUtcNow().UtcDateTime, NextAttemptAtUtc = time.GetUtcNow().UtcDateTime };
            db.SmsMessages.Add(row); return row.Id;
        }, ct);
    }

    /// <summary>Returns a bounded audit projection, never message bodies or unmasked phone numbers.</summary>
    public sealed class HistoryHandler(AppDbContext db) : IRequestHandler<History,object>
    {
        public async Task<object> Handle(History request, CancellationToken ct)
        {
            int page = Math.Max(1, request.Page);
            var query = db.SmsMessages.AsNoTracking().Where(x => request.Status == null || x.Status == request.Status);
            int total = await query.CountAsync(ct);
            var rows = await query.OrderByDescending(x => x.CreatedAtUtc).Skip((page-1)*25).Take(25).ToListAsync(ct);
            return new { total, page, items = rows.Select(x => new { x.Id, x.Event, phone = SmsPolicy.Mask(x.Phone), x.Provider, x.Status, createdAtUtc = DateTime.SpecifyKind(x.CreatedAtUtc,DateTimeKind.Utc), x.Attempts, x.ErrorCode }) };
        }
    }

    /// <summary>Lists selectable verified accounts and their server-derived roles, without accepting raw recipient phone input.</summary>
    public sealed class RecipientsHandler(AppDbContext db) : IRequestHandler<Recipients,object>
    {
        public async Task<object> Handle(Recipients request, CancellationToken ct)
        {
            var users = await db.Users.AsNoTracking().Where(x => x.PhoneNumberConfirmed && x.PhoneNumber != null).OrderBy(x => x.FullName).Take(1000).ToListAsync(ct);
            var adminIds = await db.UserRoles.Where(x => db.Roles.Any(r => r.Id == x.RoleId && r.Name == "Admin")).Select(x => x.UserId).ToListAsync(ct);
            return users.Select(x => new { x.Id, name = x.FullName, phone = SmsPolicy.Mask(x.PhoneNumber!), isAdmin = adminIds.Contains(x.Id) });
        }
    }
}

/// <summary>Public capability read, intentionally excluding provider details and secret configuration.</summary>
public static class SmsCapabilities
{
    public sealed record Query : IRequest<object>;
    public sealed class Handler(AppDbContext db,IEnumerable<ISmsGateway> gateways) : IRequestHandler<Query,object>
    {
        public async Task<object> Handle(Query request,CancellationToken ct)
        {
            var policy = await SmsPolicy.ReadAsync(db,ct);
            bool ready = policy.Enabled && gateways.Any(x => x.Id == policy.Provider && x.OtpConfigured);
            return new { phoneLogin = ready && policy.PhoneLogin, passwordRecovery = ready && policy.PasswordRecovery, phoneVerification = ready && policy.PhoneVerification };
        }
    }
}
