using Domain.Entities;

namespace Application.Seo;

/// <summary>Optional editable fields shared by product/category forms. Missing input preserves existing metadata.</summary>
public sealed record SeoInput(string? Title = null, string? Description = null, string? FocusKeyphrase = null,
    string? RelatedKeyphrases = null, string? CanonicalUrl = null, bool Index = true, bool Follow = true,
    string? SocialTitle = null, string? SocialDescription = null, string? SocialImageUrl = null);

/// <summary>Safe editorial fields plus a versioned deterministic score; never includes AI credentials.</summary>
public sealed record SeoDto(SeoInput Fields, int? Score, string? AnalysisVersion);

/// <summary>Bounded draft analysis input. Only public editorial content is eligible for optional AI suggestions.</summary>
public sealed record SeoDraft(string Kind, Guid? Id, string Name, string Slug, string? Content, SeoInput? Seo,
    IReadOnlyList<SeoImage>? Images = null);
public sealed record SeoImage(string Url, string? Alt);
public sealed record SeoCheck(string Code, string Message, int Points, int Maximum, string State);
public sealed record SeoReadability(int Words, int Sentences, int LongSentences, int LongParagraphs);
public sealed record SeoAnalysis(int Score, string Version, string EffectiveTitle, string EffectiveDescription,
    IReadOnlyList<SeoCheck> Checks, SeoReadability Readability, IReadOnlyList<string> TechnicalWarnings);

/// <summary>Maps the established catalog DTO pattern without coupling domain entities to UI models.</summary>
public static class SeoMapping
{
    public static SeoDto? Map(SeoMetadata? value) => value is null ? null : new(new(value.Title, value.Description,
        value.FocusKeyphrase, value.RelatedKeyphrases, value.CanonicalUrl, value.Index, value.Follow,
        value.SocialTitle, value.SocialDescription, value.SocialImageUrl), value.Score, value.AnalysisVersion);

    /// <summary>Builds a fresh owned value; callers retain old values when the optional input is omitted.</summary>
    public static SeoMetadata FromInput(SeoInput input) => new()
    {
        Title = input.Title?.Trim(), Description = input.Description?.Trim(), FocusKeyphrase = input.FocusKeyphrase?.Trim(),
        RelatedKeyphrases = input.RelatedKeyphrases?.Trim(), CanonicalUrl = input.CanonicalUrl?.Trim(),
        Index = input.Index, Follow = input.Follow, SocialTitle = input.SocialTitle?.Trim(),
        SocialDescription = input.SocialDescription?.Trim(), SocialImageUrl = input.SocialImageUrl?.Trim()
    };

    /// <summary>Rejects unsafe URLs and excessive fields before any product, file or taxonomy mutation.</summary>
    public static string? Validate(SeoInput? value)
    {
        if (value is null) return null;
        if (value.Title?.Length > 250 || value.Description?.Length > 500 || value.FocusKeyphrase?.Length > 150
            || value.RelatedKeyphrases?.Length > 1000 || value.SocialTitle?.Length > 250 || value.SocialDescription?.Length > 500)
            return "SEO: one or more fields exceed the permitted length.";
        if (value.CanonicalUrl?.Length > 1000 || (!string.IsNullOrWhiteSpace(value.CanonicalUrl) && !PublicUrl(value.CanonicalUrl)))
            return "SEO: canonical must be an absolute HTTP(S) URL without credentials.";
        if (value.SocialImageUrl?.Length > 500 || (!string.IsNullOrWhiteSpace(value.SocialImageUrl)
            && !PublicUrl(value.SocialImageUrl) && !value.SocialImageUrl.StartsWith("/uploads/", StringComparison.Ordinal)))
            return "SEO: social image must be a public HTTP(S) URL or an uploaded image.";
        return null;
    }

    public static bool PublicUrl(string value) => Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && uri.Scheme is "https" or "http" && string.IsNullOrEmpty(uri.UserInfo);
}
