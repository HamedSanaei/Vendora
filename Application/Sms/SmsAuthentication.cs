using System.Security.Cryptography;
using System.Text;
using Application.Accounting;
using Application.Auth;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Persistence;
using Persistence.Identity;

namespace Application.Sms;

public sealed record SmsAuthReply(int Status, string? Error = null, Guid? ChallengeId = null, int CodeLength = 5,
    int RetryAfter = 120, Account.AccountDto? Account = null, string? ResetGrant = null);

/// <summary>Real purpose-bound customer sign-in/recovery and administrator delivery tests. No fake sessions or raw OTP responses.</summary>
public static class SmsAuthentication
{
    public sealed record Request(string Phone, string Purpose, Guid? Actor = null) : IRequest<SmsAuthReply>;
    public sealed record Verify(Guid ChallengeId, string Code, string Purpose, Guid? Actor = null) : IRequest<SmsAuthReply>;
    public sealed record Reset(Guid ChallengeId, string Grant, string Password) : IRequest<SmsAuthReply>;

    /// <summary>Reserves the shared budget before external I/O and stores only the returned code's salted hash.</summary>
    public sealed class RequestHandler(AppDbContext db, IEnumerable<ISmsGateway> gateways, TimeProvider time) : IRequestHandler<Request,SmsAuthReply>
    {
        public async Task<SmsAuthReply> Handle(Request request, CancellationToken ct)
        {
            if (request.Purpose is not ("Login" or "Recovery" or "Test")) return new(400, "INVALID_OTP_PURPOSE");
            var policy = await SmsPolicy.ReadAsync(db, ct);
            if (!policy.Enabled || request.Purpose == "Login" && !policy.PhoneLogin || request.Purpose == "Recovery" && !policy.PasswordRecovery)
                return new(503, "SMS_AUTH_UNAVAILABLE");
            var gateway = SmsPolicy.Gateway(policy, gateways);
            if (!SmsCodeTemplates.IsConfigured(policy, gateway)) return new(503, "SMS_NOT_CONFIGURED");
            string? testPhone = request.Purpose == "Test"
                ? (await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.Actor && x.PhoneNumberConfirmed, ct))?.PhoneNumber
                : null;
            // Initial phone verification uses the authenticated profile flow; a delivery test must not bootstrap ownership.
            if (request.Purpose == "Test" && string.IsNullOrWhiteSpace(testPhone)) return new(400, "SMS_VERIFIED_RECIPIENT_REQUIRED");
            string phone = SmsPolicy.Phone(request.Purpose == "Test" ? testPhone : request.Phone);
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await new AccountingUnitOfWork(db, time).AcquireGateAsync(ct);
            Guid? owner = await PhoneOwnership.ResolveAsync(db, phone, ct);
            var user = owner.HasValue ? await db.Users.AsNoTracking().SingleAsync(x => x.Id == owner, ct) : null;
            if (request.Purpose == "Test" && (request.Actor is null || request.Actor != owner)) return new(400, "SMS_TEST_OWN_PHONE_ONLY");
            int retry = await SmsBudget.SpendAsync(db, phone, time.GetUtcNow().UtcDateTime, ct);
            if (retry > 0) return new(429, "RESEND_WAIT", RetryAfter: retry);
            bool admin = owner.HasValue && await db.UserRoles.AnyAsync(x => x.UserId == owner && db.Roles.Any(r => r.Id == x.RoleId && r.Name == "Admin"), ct);
            bool decoy = request.Purpose != "Test" && (admin || (request.Purpose == "Recovery" && owner is null) || user?.LockoutEnd > time.GetUtcNow());
            foreach (var old in await db.SmsChallenges.Where(x => x.Phone == phone && x.Purpose == request.Purpose && (!x.Consumed || x.RecoveryHash != null)).ToListAsync(ct))
            { old.CodeHash = null; old.RecoveryHash = null; old.Consumed = true; old.Version = Guid.NewGuid(); }
            var challenge = new SmsChallenge { Phone = phone, UserId = owner, Purpose = request.Purpose, ProfileStamp = user?.ConcurrencyStamp, ExpiresAtUtc = time.GetUtcNow().UtcDateTime.AddMinutes(5) };
            var log = new SmsMessage { Id = challenge.Id, Event = "Otp" + request.Purpose, EventKey = "otp:" + challenge.Id, UserId = owner, ActorId = request.Actor,
                Phone = phone, Body = "", Provider = policy.Provider, SettingsVersion = policy.Version, LeaseUntilUtc = time.GetUtcNow().UtcDateTime.AddMinutes(1), Status = decoy ? "Cancelled" : "Sending", Attempts = decoy ? 0 : 1 };
            db.AddRange(challenge, log);
            try { await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); }
            catch (DbUpdateException) { return new(409, "VERIFICATION_CONFLICT"); }
            if (decoy) return new(200, ChallengeId: challenge.Id, CodeLength: SmsCodeTemplates.UsesBranded(policy, gateway) ? 6 : 5);
            string? code;
            var purpose = request.Purpose == "Recovery" ? SmsCodePurpose.Recovery : request.Purpose == "Test" ? SmsCodePurpose.Test
                : owner.HasValue ? SmsCodePurpose.Login : SmsCodePurpose.Registration;
            try { code = await SmsCodeTemplates.SendAsync(policy, gateway, phone, purpose, ct); }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException) { code = null; }
            log.LeaseUntilUtc = null; log.Status = code is null ? "Unknown" : "Accepted"; log.ErrorCode = code is null ? "SMS_ACCEPTANCE_UNKNOWN" : null;
            if (code is not null) challenge.CodeHash = new PasswordHasher<SmsChallenge>().HashPassword(challenge, code);
            challenge.Version = Guid.NewGuid(); log.Version = Guid.NewGuid();
            try { await db.SaveChangesAsync(ct); } catch (DbUpdateException) { return new(409, "VERIFICATION_CONFLICT"); }
            return code is null ? new(503, "SMS_SEND_FAILED") : new(200, ChallengeId: challenge.Id, CodeLength: code.Length);
        }
    }

    /// <summary>Consumes a proof atomically; confirmed old accounts are never merged with unverified phone assertions.</summary>
    public sealed class VerifyHandler(AppDbContext db, UserManager<AppUser> users, RoleManager<IdentityRole<Guid>> roles,
        IConfiguration configuration, TimeProvider time) : IRequestHandler<Verify,SmsAuthReply>
    {
        public async Task<SmsAuthReply> Handle(Verify request, CancellationToken ct)
        {
            if (request.Purpose is not ("Login" or "Recovery" or "Test")) return new(400, "INVALID_OTP_PURPOSE");
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await new AccountingUnitOfWork(db, time).AcquireGateAsync(ct);
            var challenge = await db.SmsChallenges.SingleOrDefaultAsync(x => x.Id == request.ChallengeId && x.Purpose == request.Purpose, ct);
            if (challenge is null || challenge.Consumed || challenge.ExpiresAtUtc <= time.GetUtcNow().UtcDateTime || challenge.CodeHash is null) return new(400, "CODE_EXPIRED");
            if (request.Purpose == "Test" && request.Actor != challenge.UserId) return new(403, "OTP_NOT_ALLOWED");
            if (challenge.Attempts >= 5) return new(429, "CODE_ATTEMPT_LIMIT");
            var policy = await SmsPolicy.ReadAsync(db, ct);
            if (!policy.Enabled || request.Purpose == "Login" && !policy.PhoneLogin || request.Purpose == "Recovery" && !policy.PasswordRecovery) return new(503, "SMS_AUTH_UNAVAILABLE");
            challenge.Attempts++; challenge.Version = Guid.NewGuid();
            string code = CustomerProfile.NormalizeDigits(request.Code ?? "");
            bool valid = code.Length is >= 4 and <= 8 && code.All(char.IsAsciiDigit) && new PasswordHasher<SmsChallenge>().VerifyHashedPassword(challenge, challenge.CodeHash, code) != PasswordVerificationResult.Failed;
            if (!valid) { await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return new(400, "INVALID_CODE"); }
            challenge.Consumed = true; challenge.CodeHash = null;
            if (request.Purpose == "Test") { await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return new(200); }
            Guid? owner = await PhoneOwnership.ResolveAsync(db, challenge.Phone, ct);
            if (challenge.UserId != owner) return new(400, "CODE_EXPIRED");
            var user = owner.HasValue ? await users.FindByIdAsync(owner.ToString()!) : null;
            if (user is not null && (user.ConcurrencyStamp != challenge.ProfileStamp || await users.IsLockedOutAsync(user) || await users.IsInRoleAsync(user, "Admin"))) return new(403, "OTP_NOT_ALLOWED");
            if (request.Purpose == "Recovery")
            {
                if (user is null) return new(400, "CODE_EXPIRED");
                string grant = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
                challenge.RecoveryHash = Hash(grant); challenge.ExpiresAtUtc = time.GetUtcNow().UtcDateTime.AddMinutes(5);
                await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return new(200, ChallengeId: challenge.Id, ResetGrant: grant);
            }
            if (user is null)
            {
                bool existing = (await db.Users.AsNoTracking().Where(x => x.PhoneNumber != null && !x.PhoneNumberConfirmed).Select(x => x.PhoneNumber!).ToListAsync(ct)).Any(x => PhoneOwnership.Normalize(x) == challenge.Phone);
                if (existing) { await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return new(409, "ACCOUNT_LINK_REQUIRED"); }
                user = new AppUser { Id = Guid.NewGuid(), UserName = "phone-" + Guid.NewGuid().ToString("N"), PhoneNumber = challenge.Phone, PhoneNumberConfirmed = true };
                var created = await users.CreateAsync(user);
                if (!created.Succeeded) throw new AccountingException("PHONE_ACCOUNT_CREATE_FAILED", 409);
                if (!await roles.RoleExistsAsync("Customer"))
                { var role = await roles.CreateAsync(new IdentityRole<Guid>("Customer")); if (!role.Succeeded) throw new AccountingException("PHONE_ACCOUNT_CREATE_FAILED"); }
                if (!(await users.AddToRoleAsync(user, "Customer")).Succeeded) throw new AccountingException("PHONE_ACCOUNT_CREATE_FAILED");
            }
            await PhoneOwnership.ClaimAsync(db, user.Id, challenge.Phone, ct);
            var account = new Account.AccountDto(user.Id, user.FullName, user.Email ?? "", "Customer",
                await Account.CreateAccountTokenAsync(users, configuration, user, "Customer"), user.PhoneNumber, user.Bio) { Completion = CustomerProfile.Describe(user) };
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return new(200, Account: account);
        }
    }

    /// <summary>Exchanges a purpose-bound, single-use reset grant for a validated Identity password; never returns an Identity reset token.</summary>
    public sealed class ResetHandler(AppDbContext db, UserManager<AppUser> users, TimeProvider time) : IRequestHandler<Reset,SmsAuthReply>
    {
        public async Task<SmsAuthReply> Handle(Reset request, CancellationToken ct)
        {
            if (request.Grant is null || request.Grant.Length != 64 || request.Password is null || request.Password.Length > 128) return new(400, "INVALID_RESET_GRANT");
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            await new AccountingUnitOfWork(db, time).AcquireGateAsync(ct);
            var challenge = await db.SmsChallenges.SingleOrDefaultAsync(x => x.Id == request.ChallengeId && x.Purpose == "Recovery", ct);
            if (challenge?.RecoveryHash is null || challenge.RecoveryHash != Hash(request.Grant) || challenge.ExpiresAtUtc <= time.GetUtcNow().UtcDateTime || !challenge.UserId.HasValue) return new(400, "INVALID_RESET_GRANT");
            var policy = await SmsPolicy.ReadAsync(db, ct);
            if (!policy.Enabled || !policy.PasswordRecovery) return new(503, "SMS_AUTH_UNAVAILABLE");
            var user = await users.FindByIdAsync(challenge.UserId.ToString()!);
            if (user is null || !user.PhoneNumberConfirmed || PhoneOwnership.Normalize(user.PhoneNumber ?? "") != challenge.Phone ||
                user.ConcurrencyStamp != challenge.ProfileStamp || await users.IsInRoleAsync(user, "Admin") || await users.IsLockedOutAsync(user)) return new(400, "INVALID_RESET_GRANT");
            var token = await users.GeneratePasswordResetTokenAsync(user);
            var result = await users.ResetPasswordAsync(user, token, request.Password);
            if (!result.Succeeded) return new(400, "PASSWORD_POLICY_FAILED");
            user.TokensRevokedAtUtc = time.GetUtcNow().UtcDateTime; challenge.RecoveryHash = null; challenge.Version = Guid.NewGuid();
            await new SmsNotifications(db,time).CustomerAsync("PasswordChanged", "reset:" + challenge.Id, user.Id, null, ct);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return new(200);
        }
    }

    /// <summary>Hashes only high-entropy recovery grants; OTPs use the salted Identity password hasher instead.</summary>
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
}

/// <summary>Preserves all Identity checks, allowing a genuinely verified phone-only account to supply its email later.</summary>
public sealed class VerifiedPhoneUserValidator(IdentityErrorDescriber errors) : UserValidator<AppUser>(errors)
{
    public override async Task<IdentityResult> ValidateAsync(UserManager<AppUser> manager, AppUser user)
    {
        var result = await base.ValidateAsync(manager, user);
        if (user.Email is not null || !user.PhoneNumberConfirmed || !CustomerProfile.ValidPhone(user.PhoneNumber)) return result;
        var remaining = result.Errors.Where(x => x.Code != nameof(IdentityErrorDescriber.InvalidEmail)).ToArray();
        return remaining.Length == 0 ? IdentityResult.Success : IdentityResult.Failed(remaining);
    }
}
