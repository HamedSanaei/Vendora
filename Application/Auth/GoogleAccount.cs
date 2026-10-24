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
            if (claim is null)
                return Account.Result.Fail("Google sign-in could not be verified.");

            AppUser? user = await users.FindByLoginAsync("Google", claim.Subject);
            if (user is null)
            {
                // Do NOT trust a matching email as evidence of ownership of a password account.
                // Existing users can link Google explicitly while signed in.
                if (await users.FindByEmailAsync(claim.Email) is not null)
                    return Account.Result.Fail("GOOGLE_ACCOUNT_LINK_REQUIRED");

                var name = string.IsNullOrWhiteSpace(claim.Name) ? claim.Email.Split('@')[0] : claim.Name.Trim();
                user = new AppUser
                {
                    UserName = claim.Email,
                    Email = claim.Email,
                    FullName = name,
                    EmailConfirmed = true,
                };
                IdentityResult created = await users.CreateAsync(user);
                if (!created.Succeeded)
                    return Account.Result.Fail("Could not create Google account.");

                IdentityResult linked = await users.AddLoginAsync(user, new UserLoginInfo("Google", claim.Subject, "Google"));
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
            if (claim is null)
                return Account.Result.Fail("Google sign-in could not be verified.");
            var user = await users.FindByIdAsync(request.UserId.ToString());
            if (user is null || !string.Equals(user.Email, claim.Email, StringComparison.OrdinalIgnoreCase))
                return Account.Result.Fail("The Google email must match your account email.");
            if (await users.IsLockedOutAsync(user))
                return Account.Result.Fail("Account is locked.");
            var linkedTo = await users.FindByLoginAsync("Google", claim.Subject);
            if (linkedTo is not null && linkedTo.Id != user.Id)
                return Account.Result.Fail("This Google account is already linked to another account.");
            var logins = await users.GetLoginsAsync(user);
            if (logins.Any(x => x.LoginProvider == "Google" && x.ProviderKey != claim.Subject))
                return Account.Result.Fail("This account already has a different Google identity.");
            if (linkedTo is null)
            {
                var result = await users.AddLoginAsync(user, new UserLoginInfo("Google", claim.Subject, "Google"));
                if (!result.Succeeded)
                    return Account.Result.Fail("Unable to link the Google account.");
            }
            return await TokenForAsync(users, settings, user);
        }
    }

    private static async Task<GoogleJsonWebSignature.Payload?> VerifyAsync(
        IConfiguration settings, string? credential, CancellationToken ct)
    {
        string clientId = settings["Google:ClientId"]?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(clientId)
            || string.IsNullOrWhiteSpace(credential)
            || credential.Length > 12000)
            return null;
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
                return null;
            return payload;
        }
        catch (InvalidJwtException)
        {
            return null;
        }
        catch (ArgumentException)
        {
            return null;
        }
    }

    private static async Task<Account.Result> TokenForAsync(UserManager<AppUser> users, IConfiguration settings, AppUser user)
    {
        var role = (await users.GetRolesAsync(user)).FirstOrDefault() ?? UserRole.Customer.ToString();
        string token = await Account.CreateAccountTokenAsync(users, settings, user, role);
        return new Account.Result(true, null, new Account.AccountDto(user.Id,
            user.FullName, user.Email ?? "", role, token, user.PhoneNumber, user.Bio));
    }
}
