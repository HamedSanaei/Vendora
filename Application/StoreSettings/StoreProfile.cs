namespace Application.StoreSettings;

/// <summary>Public presentation overrides. Empty fields deliberately retain the original storefront copy.</summary>
public sealed record StoreProfile
{
    public string? NameFa { get; init; }
    public string? NameEn { get; init; }
    public string? LogoUrl { get; init; }
    public string? FaviconUrl { get; init; }
    public string? TaglineFa { get; init; }
    public string? TaglineEn { get; init; }
    public string? IntroFa { get; init; }
    public string? IntroEn { get; init; }
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string? AddressFa { get; init; }
    public string? AddressEn { get; init; }
    public string? HoursFa { get; init; }
    public string? HoursEn { get; init; }
    public string? SocialProfiles { get; init; }
    public string? CopyrightFa { get; init; }
    public string? CopyrightEn { get; init; }
    public bool EnamadEnabled { get; init; }
    public EnamadBadge? Enamad { get; init; }
}

/// <summary>Extracted badge data only; arbitrary markup and JavaScript never reach the storefront.</summary>
public sealed record EnamadBadge(string Href, string ImageUrl);

/// <summary>Admin input carries the provider snippet separately from the public presentation DTO.</summary>
public sealed record StoreSettingsInput(StoreProfile Profile, string? EnamadCode = null);
