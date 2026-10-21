using System.Net.Mail;
using System.Text.Json;
using Application.Interfaces;
using Application.Slideshow;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.StoreSettings;

/// <summary>Reads and atomically saves presentation settings without changing technical SEO configuration.</summary>
public static class StoreSettingsUseCases
{
    /// <summary>Requests the public presentation overrides without mutating default state.</summary>
    public sealed record Query : IRequest<StoreProfile>;
    /// <summary>Replaces presentation overrides and optionally uploads new logo/icon files.</summary>
    public sealed record Command(StoreSettingsInput Input, ProductImageUpload? Logo = null,
        ProductImageUpload? Favicon = null) : IRequest<Result>;
    /// <summary>Contains saved presentation data or stable field-level validation codes.</summary>
    public sealed record Result(StoreProfile? Profile = null, IReadOnlyDictionary<string, string>? Errors = null);

    /// <summary>Uses the existing explicit mapping convention; this repository has no AutoMapper dependency.</summary>
    public static StoreProfile Read(SeoSettings settings)
    {
        var profile = settings.StoreProfileJson is null ? new StoreProfile()
            : JsonSerializer.Deserialize<StoreProfile>(settings.StoreProfileJson) ?? new StoreProfile();
        var social = (settings.SocialProfiles ?? "").Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(url => Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme is "https" or "http" && uri.UserInfo.Length == 0);
        return profile with { NameFa = settings.SiteName == "وندورا" ? null : settings.SiteName,
            LogoUrl = settings.LogoUrl, SocialProfiles = string.IsNullOrWhiteSpace(settings.SocialProfiles) ? null : string.Join('\n', social) };
    }

    /// <summary>Reads the singleton without persisting defaults on a public request.</summary>
    public sealed class QueryHandler(AppDbContext db) : IRequestHandler<Query, StoreProfile>
    {
        /// <inheritdoc />
        public async Task<StoreProfile> Handle(Query request, CancellationToken cancellationToken)
            => Read(await db.SeoSettings.AsNoTracking().SingleOrDefaultAsync(cancellationToken) ?? new SeoSettings());
    }

    /// <summary>Validates all input before uploading and removes only newly created files on persistence failure.</summary>
    public sealed class CommandHandler(AppDbContext db, IProductImageStorage storage, IEnamadCodeParser badges)
        : IRequestHandler<Command, Result>
    {
        /// <inheritdoc />
        public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
        {
            var errors = new Dictionary<string, string>();
            var row = await db.SeoSettings.SingleOrDefaultAsync(cancellationToken);
            var current = Read(row ?? new SeoSettings());
            var input = request.Input.Profile;
            // Reflection is limited to this sealed, scalar DTO so every text field gets the same bounds and trimming.
            var text = typeof(StoreProfile).GetProperties().Where(p => p.PropertyType == typeof(string));
            foreach (var property in text)
            {
                string? value = (string?)property.GetValue(input);
                if (value?.Length > (property.Name.StartsWith("Intro") || property.Name == "SocialProfiles" ? 2000 : 500))
                    errors[JsonNamingPolicy.CamelCase.ConvertName(property.Name)] = "tooLong";
            }
            if (!string.IsNullOrWhiteSpace(input.Email) && (!MailAddress.TryCreate(input.Email.Trim(), out var email) || email.Address != input.Email.Trim())) errors["email"] = "invalidEmail";
            string? phone = input.Phone is null ? null : string.Concat(input.Phone.Select(c => c is >= '۰' and <= '۹' ? (char)('0' + c - '۰') : c is >= '٠' and <= '٩' ? (char)('0' + c - '٠') : c));
            if (!string.IsNullOrWhiteSpace(phone) && (phone.Length > 40 || !phone.Any(char.IsAsciiDigit) || phone.Any(c => !char.IsAsciiDigit(c) && !"+()- .".Contains(c)))) errors["phone"] = "invalidPhone";
            if (input.NameFa?.Length > 150) errors["nameFa"] = "tooLong";
            if (input.NameEn?.Length > 150) errors["nameEn"] = "tooLong";
            if ((input.SocialProfiles ?? "").Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).Any(url => !PublicUrl(url)))
                errors["socialProfiles"] = "invalidUrl";
            if (!string.IsNullOrWhiteSpace(input.LogoUrl) && input.LogoUrl != current.LogoUrl) errors["logo"] = "uploadRequired";
            if (!string.IsNullOrWhiteSpace(input.FaviconUrl) && input.FaviconUrl != current.FaviconUrl) errors["favicon"] = "uploadRequired";
            EnamadBadge? badge = null;
            if (!string.IsNullOrWhiteSpace(request.Input.EnamadCode))
            {
                badge = badges.Parse(request.Input.EnamadCode);
                if (badge is null) errors["enamadCode"] = "invalidBadge";
            }
            if (input.EnamadEnabled && badge is null) errors["enamadCode"] = "invalidBadge";
            if (request.Logo is not null && await SlideshowValidation.ValidateImageAsync(request.Logo, cancellationToken) is not null) errors["logo"] = "invalidImage";
            if (request.Favicon is not null && (Path.GetExtension(request.Favicon.FileName).ToLowerInvariant() != ".png"
                || await SlideshowValidation.ValidateImageAsync(request.Favicon, cancellationToken) is not null)) errors["favicon"] = "invalidPng";
            if (errors.Count != 0) return new(Errors: errors);

            var normalized = input with { Enamad = badge, Phone = phone };
            foreach (var property in text)
            {
                string? value = ((string?)property.GetValue(normalized))?.Trim();
                property.SetValue(normalized, string.IsNullOrWhiteSpace(value) ? null : value);
            }
            var created = new List<string>();
            try
            {
                if (request.Logo is not null)
                {
                    var file = await storage.SaveAsync(request.Logo, cancellationToken); created.Add(file.Url);
                    normalized = normalized with { LogoUrl = file.Url };
                }
                if (request.Favicon is not null)
                {
                    var file = await storage.SaveAsync(request.Favicon, cancellationToken); created.Add(file.Url);
                    normalized = normalized with { FaviconUrl = file.Url };
                }
                if (row is null) { row = new SeoSettings(); db.SeoSettings.Add(row); }
                row.SiteName = normalized.NameFa ?? "وندورا";
                row.LogoUrl = normalized.LogoUrl;
                row.SocialProfiles = normalized.SocialProfiles;
                // Shared identity fields live only in their established columns, including legacy SEO writes.
                row.StoreProfileJson = JsonSerializer.Serialize(normalized with { NameFa = null, LogoUrl = null, SocialProfiles = null });
                await db.SaveChangesAsync(cancellationToken);
                return new(Read(row));
            }
            catch
            {
                foreach (string url in created) await storage.DeleteAsync(url, CancellationToken.None);
                throw;
            }
        }

        /// <summary>Restricts social links to ordinary public HTTPS URLs without credentials.</summary>
        private static bool PublicUrl(string value) => Uri.TryCreate(value, UriKind.Absolute, out var uri)
            && uri.Scheme == "https" && uri.UserInfo.Length == 0 && !value.Any(char.IsControl);
    }
}
