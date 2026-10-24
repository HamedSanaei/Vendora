using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Auth;

/// <summary>Authenticated verification of the saved profile phone, with durable resend/attempt budgets and single-use codes.</summary>
public static class PhoneConfirmation
{
    public sealed record Send(Guid UserId) : IRequest<Outcome>;
    public sealed record Confirm(Guid UserId, string Code) : IRequest<Outcome>;
    public sealed record Outcome(int Status, string? Code = null, int RetryAfter = 0);

    /// <summary>Reserves a durable send slot before contacting the provider, invalidating every preceding code.</summary>
    public sealed class SendHandler(AppDbContext db, IPhoneCodeSender sender, TimeProvider time) : IRequestHandler<Send, Outcome>
    {
        public async Task<Outcome> Handle(Send request, CancellationToken ct)
        {
            var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.UserId, ct);
            if (user is null) return new(401, "UNAUTHORIZED");
            if (!CustomerProfile.ValidPhone(user.PhoneNumber)) return new(400, "PHONE_REQUIRED");
            if (user.PhoneNumberConfirmed) return new(200, "PHONE_ALREADY_VERIFIED");
            if (!sender.IsConfigured) return new(503, "SMS_NOT_CONFIGURED");
            DateTime now = time.GetUtcNow().UtcDateTime;
            var challenge = await db.PhoneVerifications.SingleOrDefaultAsync(x => x.UserId == user.Id, ct);
            if (challenge is null) { challenge = new() { UserId = user.Id, WindowStartUtc = now }; db.PhoneVerifications.Add(challenge); }
            if (challenge.NextSendAtUtc > now) return new(429, "RESEND_WAIT", (int)Math.Ceiling((challenge.NextSendAtUtc - now).TotalSeconds));
            if (challenge.WindowStartUtc.AddMinutes(30) <= now) { challenge.WindowStartUtc = now; challenge.SendCount = 0; }
            if (challenge.SendCount >= 5) return new(429, "SEND_LIMIT", (int)Math.Ceiling((challenge.WindowStartUtc.AddMinutes(30) - now).TotalSeconds));
            challenge.PhoneNumber = user.PhoneNumber!; challenge.CodeHash = null; challenge.Attempts = 0;
            challenge.ProfileStamp = user.ConcurrencyStamp;
            challenge.SendCount++; challenge.NextSendAtUtc = now.AddSeconds(120); challenge.ExpiresAtUtc = now.AddMinutes(5);
            challenge.Version = Guid.NewGuid();
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { return new(409, "VERIFICATION_CONFLICT"); }
            string? code = await sender.SendAsync(challenge.PhoneNumber, ct);
            if (code is null) return new(503, "SMS_SEND_FAILED", 120);
            // Persist only a costly salted hash after delivery is accepted; a racing resend/profile edit wins via Version.
            challenge.CodeHash = new PasswordHasher<PhoneVerification>().HashPassword(challenge, code);
            challenge.Version = Guid.NewGuid();
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { return new(409, "VERIFICATION_CONFLICT"); }
            return new(200, RetryAfter: 120);
        }
    }

    /// <summary>Confirms only the currently saved phone; consuming the code and setting the Identity flag are atomic.</summary>
    public sealed class ConfirmHandler(AppDbContext db, TimeProvider time) : IRequestHandler<Confirm, Outcome>
    {
        public async Task<Outcome> Handle(Confirm request, CancellationToken ct)
        {
            string code = CustomerProfile.NormalizeDigits(request.Code);
            if (code.Length is < 4 or > 8 || !code.All(char.IsAsciiDigit)) return new(400, "INVALID_CODE");
            var user = await db.Users.SingleOrDefaultAsync(x => x.Id == request.UserId, ct);
            if (user is null) return new(401, "UNAUTHORIZED");
            var challenge = await db.PhoneVerifications.SingleOrDefaultAsync(x => x.UserId == user.Id, ct);
            if (challenge is null || challenge.CodeHash is null || challenge.PhoneNumber != user.PhoneNumber
                || challenge.ProfileStamp != user.ConcurrencyStamp
                || challenge.ExpiresAtUtc <= time.GetUtcNow().UtcDateTime) return new(400, "CODE_EXPIRED");
            if (challenge.Attempts >= 5) return new(429, "CODE_ATTEMPT_LIMIT");
            challenge.Attempts++; challenge.Version = Guid.NewGuid();
            bool valid = new PasswordHasher<PhoneVerification>().VerifyHashedPassword(challenge, challenge.CodeHash, code) != PasswordVerificationResult.Failed;
            if (valid)
            {
                challenge.CodeHash = null; user.PhoneNumberConfirmed = true;
                user.ConcurrencyStamp = Guid.NewGuid().ToString();
            }
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { return new(409, "VERIFICATION_CONFLICT"); }
            return valid ? new(200) : new(400, "INVALID_CODE");
        }
    }
}
