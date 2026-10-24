using System.Net.Mail;
using Microsoft.EntityFrameworkCore;
using Persistence;
using Persistence.Identity;

namespace Application.Auth;

/// <summary>One authoritative completion policy for all login methods; token/browser flags cannot satisfy it.</summary>
public static class CustomerProfile
{
    public sealed record Completion(string? FirstName, string? LastName, bool PhoneNumberConfirmed, bool IsComplete);

    /// <summary>Returns the same current profile facts to email/Google sessions and profile reads.</summary>
    public static Completion Describe(AppUser user) => new(user.FirstName, user.LastName, user.PhoneNumberConfirmed, Complete(user));
    /// <summary>Normalizes Persian/Arabic digits and Iranian international prefixes to the stored local mobile format.</summary>
    public static string NormalizePhone(string? value)
    {
        string text = NormalizeDigits(value);
        if (text.StartsWith("+98", StringComparison.Ordinal)) text = "0" + text[3..];
        else if (text.StartsWith("0098", StringComparison.Ordinal)) text = "0" + text[4..];
        return text;
    }

    /// <summary>Normalizes keyboard digits without reinterpreting leading zeros in verification codes as country prefixes.</summary>
    public static string NormalizeDigits(string? value) => string.Concat((value ?? "").Trim()
        .Select(c => c is >= '۰' and <= '۹' ? (char)('0' + c - '۰') : c is >= '٠' and <= '٩' ? (char)('0' + c - '٠') : c));

    /// <summary>Checks a normalized Iranian mobile without accepting punctuation or arbitrary international numbers.</summary>
    public static bool ValidPhone(string? phone) => phone is { Length: 11 } && phone.StartsWith("09", StringComparison.Ordinal) && phone.All(char.IsAsciiDigit);

    /// <summary>Checks bounded real name input, allowing Persian and other Unicode letters.</summary>
    public static bool ValidName(string? value) => !string.IsNullOrWhiteSpace(value) && value.Trim().Length <= 100 && value.Any(char.IsLetter) && !value.Any(char.IsControl);

    /// <summary>Checks mandatory contact information independently of Google/email sign-in privileges.</summary>
    public static bool Complete(AppUser user) => ValidName(user.FirstName) && ValidName(user.LastName)
        && MailAddress.TryCreate(user.Email, out var email) && email.Address == user.Email
        && ValidPhone(user.PhoneNumber) && user.PhoneNumberConfirmed;

    /// <summary>Reads current persisted facts before a protected operation rather than trusting stale JWT claims.</summary>
    public static async Task<bool> IsCompleteAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId, ct);
        return user is not null && Complete(user);
    }

    /// <summary>Blocks a new commerce action before stock, prices or financial documents are mutated.</summary>
    public static async Task RequireAsync(AppDbContext db, Guid userId, CancellationToken ct)
    {
        if (!await IsCompleteAsync(db, userId, ct)) throw new CustomerProfileRequiredException();
    }
}

/// <summary>Signals that sign-in succeeded but required personal details/phone verification are still incomplete.</summary>
public sealed class CustomerProfileRequiredException() : Exception("PROFILE_INCOMPLETE");
