using Domain.Enums;
using Google.Apis.Auth;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Persistence.Identity;

namespace Application.Auth;

/// <summary>Google Identity Services credential exchange. Google subject is the stable identity key,
/// and an existing email account is NEVER silently linked to a Google account.</summary>
public static class GoogleAccount
{
    public sealed record LoginCommand(string Credential) : IRequest<Account.Result>;
    public sealed record LinkCommand(Guid UserId, string Credential) : IRequest<Account.Result>;

    public sealed class LoginHandler(
        UserManager<AppUser> users,
        RoleManager<IdentityRole<Guid>> roles,
        IConfiguration settings) : IRequestHandler<LoginCommand, Account.Result>
    {
        public async Task<Account.Result> Handle(LoginCommand request, CancellationToken cancellationToken)
        {
            var claim = await VerifyAsync(settings, request.Credential, cancellationToken);
            if (claim.Payload is null)
                return Account.Result.Fail(claim.Error ?? "GOOGLE_TOKEN_INVALID");
            var identity = claim.Payload;

            AppUser? user = await users.FindByLoginAsync("Google", identity.Subject);
            if (user is null)
            {
                // Do NOT trust a matching email as evidence of ownership of a password account.
                // Existing users can link Google explicitly while signed in.
                if (await users.FindByEmailAsync(identity.Email) is not null)
                    return Account.Result.Fail("GOOGLE_ACCOUNT_LINK_REQUIRED");

                var name = string.IsNullOrWhiteSpace(identity.Name) ? identity.Email.Split('@')[0] : identity.Name.Trim();
                user = new AppUser
                {
                    UserName = identity.Email,
                    Email = identity.Email,
                    FullName = name,
                    FirstName = identity.GivenName,
                    LastName = identity.FamilyName,
                    EmailConfirmed = true,
                };
                IdentityResult created = await users.CreateAsync(user);
                if (!created.Succeeded)
                    return Account.Result.Fail("Could not create Google account.");

                IdentityResult linked = await users.AddLoginAsync(user, new UserLoginInfo("Google", identity.Subject, "Google"));
                if (!linked.Succeeded)
                {
                    await users.DeleteAsync(user);
                    return Account.Result.Fail("Could not link Google account.");
                }
                if (!await roles.RoleExistsAsync(UserRole.Customer.ToString()))
                {
                    var createdRole = await roles.CreateAsync(new IdentityRole<Guid>(UserRole.Customer.ToString()));
                    if (!createdRole.Succeeded)
                        return Account.Result.Fail("Could not initialize customer role.");
                }
                var assigned = await users.AddToRoleAsync(user, UserRole.Customer.ToString());
                if (!assigned.Succeeded)
                    return Account.Result.Fail("Could not assign customer role.");
            }
            if (await users.IsLockedOutAsync(user))
                return Account.Result.Fail("Account is locked.");

            return await TokenForAsync(users, settings, user);
        }
    }

    public sealed class LinkHandler(
        UserManager<AppUser> users,
        IConfiguration settings) : IRequestHandler<LinkCommand, Account.Result>
    {
        public async Task<Account.Result> Handle(LinkCommand request, CancellationToken cancellationToken)
        {
            var claim = await VerifyAsync(settings, request.Credential, cancellationToken);
            if (claim.Payload is null)
                return Account.Result.Fail(claim.Error ?? "GOOGLE_TOKEN_INVALID");
            var identity = claim.Payload;
            var user = await users.FindByIdAsync(request.UserId.ToString());
            if (user is null || !string.Equals(user.Email, identity.Email, StringComparison.OrdinalIgnoreCase))
                return Account.Result.Fail("The Google email must match your account email.");
            if (await users.IsLockedOutAsync(user))
                return Account.Result.Fail("Account is locked.");
            var linkedTo = await users.FindByLoginAsync("Google", identity.Subject);
            if (linkedTo is not null && linkedTo.Id != user.Id)
                return Account.Result.Fail("This Google account is already linked to another account.");
            var logins = await users.GetLoginsAsync(user);
            if (logins.Any(x => x.LoginProvider == "Google" && x.ProviderKey != identity.Subject))
                return Account.Result.Fail("This account already has a different Google identity.");
            if (linkedTo is null)
            {
                var result = await users.AddLoginAsync(user, new UserLoginInfo("Google", identity.Subject, "Google"));
                if (!result.Succeeded)
                    return Account.Result.Fail("Unable to link the Google account.");
            }
            return await TokenForAsync(users, settings, user);
        }
    }

    private sealed record Verification(GoogleJsonWebSignature.Payload? Payload, string? Error = null);

    /// <summary>Retains signature/audience verification while distinguishing safe configuration, credential and transport errors.</summary>
    private static async Task<Verification> VerifyAsync(
        IConfiguration settings, string? credential, CancellationToken ct)
    {
        string clientId = settings["Google:ClientId"]?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(clientId)) return new(null, "GOOGLE_NOT_CONFIGURED");
        if (string.IsNullOrWhiteSpace(credential)
            || credential.Length > 12000)
            return new(null, "GOOGLE_TOKEN_INVALID");
        try
        {
            // Official Google library verifies signature (rotating Google keys), issuer,
            // audience, expiration, and rejects malformed/forged credentials.
            var payload = await GoogleJsonWebSignature.ValidateAsync(
                credential, new GoogleJsonWebSignature.ValidationSettings
                {
                    Audience = [clientId],
                });
            if (payload.EmailVerified != true || string.IsNullOrWhiteSpace(payload.Subject)
                || string.IsNullOrWhiteSpace(payload.Email))
                return new(null, "GOOGLE_TOKEN_INVALID");
            return new(payload);
        }
        catch (InvalidJwtException)
        {
            return new(null, "GOOGLE_TOKEN_INVALID");
        }
        catch (ArgumentException)
        {
            return new(null, "GOOGLE_TOKEN_INVALID");
        }
        catch (HttpRequestException) { return new(null, "GOOGLE_UNAVAILABLE"); }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested) { return new(null, "GOOGLE_UNAVAILABLE"); }
    }

    private static async Task<Account.Result> TokenForAsync(UserManager<AppUser> users, IConfiguration settings, AppUser user)
    {
        var role = (await users.GetRolesAsync(user)).FirstOrDefault() ?? UserRole.Customer.ToString();
        string token = await Account.CreateAccountTokenAsync(users, settings, user, role);
        return new Account.Result(true, null, new Account.AccountDto(user.Id,
            user.FullName, user.Email ?? "", role, token, user.PhoneNumber, user.Bio) { Completion = CustomerProfile.Describe(user) });
    }
}
