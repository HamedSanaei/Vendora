using System.Net;
using System.Text.RegularExpressions;
using Application.Interfaces;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Seo;

/// <summary>Deterministic Persian-first editorial checks, not a prediction of Google ranking.</summary>
public static partial class SeoAnalyzer
{
    public const string Version = "vendora-fa-1";

    /// <summary>Normalizes Arabic/Persian variants and spacing for consistent phrase matching.</summary>
    public static string Normalize(string? value) => Space().Replace(Punctuation().Replace(Diacritics().Replace((value ?? "").ToLowerInvariant()
        .Replace('ي', 'ی').Replace('ى', 'ی').Replace('ك', 'ک').Replace('\u200c', ' ').Replace('\u200d', ' '), ""), " "), " ").Trim();

    /// <summary>Computes six fixed-weight groups from sanitized text, real images and same-store links.</summary>
    public static SeoAnalysis Analyze(SeoDraft draft, SeoSettings settings, IProductDescriptionService descriptions,
        bool uniqueTitle = true, bool uniqueDescription = true)
    {
        string html = descriptions.Sanitize(draft.Content) ?? "";
        string text = Plain(html);
        string title = EffectiveTitle(draft.Name, draft.Seo, settings);
        string description = string.IsNullOrWhiteSpace(draft.Seo?.Description) ? descriptions.Excerpt(html, 160) ?? "" : draft.Seo.Description.Trim();
        var checks = new List<SeoCheck>();
        void Add(string code, string message, bool passed, int maximum) => checks.Add(new(code, message, passed ? maximum : 0, maximum, passed ? "good" : "warning"));
        Add("title", "عنوان سئو مشخص باشد.", title.Length > 0, 10);
        Add("titleLength", "طول پیشنهادی عنوان بین ۳۰ تا ۶۰ کاراکتر است؛ این یک راهنماست، نه قانون رتبه‌بندی.", title.Length is >= 30 and <= 60, 5);
        Add("description", "توضیحات متا نوشته شود.", description.Length > 0, 10);
        Add("descriptionLength", "طول پیشنهادی توضیحات متا بین ۱۱۰ تا ۱۶۰ کاراکتر است.", description.Length is >= 110 and <= 160, 5);
        string phrase = Normalize(draft.Seo?.FocusKeyphrase);
        bool Contains(string? content) => phrase.Length > 0 && (" " + Normalize(content) + " ").Contains(" " + phrase + " ", StringComparison.Ordinal);
        Add("focus", "عبارت هدف اصلی تعیین شود.", phrase.Length > 0, 5);
        Add("focusTitle", "عبارت هدف به‌صورت طبیعی در عنوان استفاده شود.", Contains(title), 5);
        Add("focusDescription", "عبارت هدف در توضیحات متا بررسی شود.", Contains(description), 5);
        Add("focusSlug", "عبارت هدف در نامک بررسی شود.", Contains(draft.Slug.Replace('-', ' ')), 5);
        Add("focusIntro", "موضوع اصلی در ابتدای محتوا روشن باشد.", Contains(text.Length > 600 ? text[..600] : text), 5);
        Add("focusHeading", "یک زیرعنوان مرتبط با عبارت هدف داشته باشید.", Headings().Matches(html).Any(match => Contains(Plain(match.Value))), 5);
        var words = Words(text);
        Add("content", "برای محتوای مفید و اختصاصی، ۱۵۰ واژه یک راهنمای پیشنهادی است؛ متن کوتاه مناسب هم می‌تواند مفید باشد.", words >= 150, 10);
        Add("headings", "برای محتوای بلند از زیرعنوان استفاده کنید.", words < 150 || Headings().IsMatch(html), 5);
        var images = (draft.Images ?? []).Concat(ImageTags().Matches(html).Select(match => new SeoImage(
            Attribute(match.Value, "src"), Attribute(match.Value, "alt")))).Where(x => !string.IsNullOrWhiteSpace(x.Url)).ToList();
        Add("image", "تصویر واقعی محصول یا دسته ثبت شود.", images.Count > 0, 5);
        Add("alt", "تصاویر متن جایگزین توصیفی داشته باشند.", images.Count > 0 && images.All(x => !string.IsNullOrWhiteSpace(x.Alt)), 5);
        Add("internalLink", "در صورت مرتبط‌بودن، به محصول یا دستهٔ دیگری در فروشگاه لینک بدهید.", Links().Matches(html).Any(match => InternalLink(Attribute(match.Value, "href"), settings.SiteUrl)), 5);
        Add("uniqueTitle", "عنوان سئو با محتوای دیگری تکراری نباشد.", uniqueTitle, 5);
        Add("uniqueDescription", "توضیحات متا اختصاصی باشد.", uniqueDescription, 5);
        var sentences = Regex.Split(text, @"[.!؟?؛\n]+").Where(x => Words(x) > 0).ToArray();
        var paragraphs = Regex.Split(html, @"</(?:p|li|h[1-6])>", RegexOptions.IgnoreCase).Select(Plain).Where(x => Words(x) > 0).ToArray();
        var warnings = new List<string>();
        if (draft.Seo?.Index == false) warnings.Add("این صفحه عمداً برای ایندکس بسته شده است.");
        if (!settings.IsIndexingEnabled) warnings.Add("ایندکس عمومی سایت تا تأیید مدیر خاموش است.");
        if (SeoMapping.Validate(draft.Seo) is string validation) warnings.Add(validation);
        return new(checks.Sum(x => x.Points), Version, title, description, checks,
            new(words, sentences.Length, sentences.Count(x => Words(x) > 25), paragraphs.Count(x => Words(x) > 150)), warnings);
    }

    public static string EffectiveTitle(string name, SeoInput? fields, SeoSettings settings) => !string.IsNullOrWhiteSpace(fields?.Title)
        ? fields.Title.Trim() : settings.TitleTemplate.Replace("{title}", name).Replace("{siteName}", settings.SiteName);
    public static string Plain(string html) => Space().Replace(WebUtility.HtmlDecode(Regex.Replace(html, "<[^>]+>", " ")), " ").Trim();
    private static int Words(string text) => Normalize(text).Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
    private static string Attribute(string tag, string name) => WebUtility.HtmlDecode(Regex.Match(tag, $"\\b{name}\\s*=\\s*[\"']([^\"']*)[\"']", RegexOptions.IgnoreCase).Groups[1].Value);
    private static bool InternalLink(string href, string origin) => href.StartsWith("/fa/", StringComparison.Ordinal)
        || (Uri.TryCreate(href, UriKind.Absolute, out var link) && Uri.TryCreate(origin, UriKind.Absolute, out var site) && link.Authority == site.Authority);
    [GeneratedRegex(@"\s+")] private static partial Regex Space();
    [GeneratedRegex(@"[\p{P}\p{S}]")] private static partial Regex Punctuation();
    [GeneratedRegex(@"[\u064B-\u065F\u0670\u0640]")] private static partial Regex Diacritics();
    [GeneratedRegex(@"<h[2-6]\b[^>]*>.*?</h[2-6]>", RegexOptions.IgnoreCase | RegexOptions.Singleline)] private static partial Regex Headings();
    [GeneratedRegex(@"<img\b[^>]*>", RegexOptions.IgnoreCase)] private static partial Regex ImageTags();
    [GeneratedRegex(@"<a\b[^>]*>", RegexOptions.IgnoreCase)] private static partial Regex Links();

    /// <summary>Assesses uniqueness in two bounded metadata projections, never by loading product image graphs.</summary>
    public static async Task<SeoAnalysis> AnalyzeAsync(AppDbContext db, SeoDraft draft, IProductDescriptionService descriptions, CancellationToken ct)
    {
        var settings = await db.SeoSettings.AsNoTracking().SingleOrDefaultAsync(ct) ?? new SeoSettings();
        var target = Analyze(draft, settings, descriptions);
        var products = await db.Products.AsNoTracking().Where(x => x.Id != draft.Id)
            .Select(x => new { Name = x.Title, Title = x.Seo != null ? x.Seo.Title : null, Description = x.Seo != null ? x.Seo.Description : null }).ToListAsync(ct);
        var categories = await db.Categories.AsNoTracking().Where(x => x.Id != draft.Id)
            .Select(x => new { x.Name, Title = x.Seo != null ? x.Seo.Title : null, Description = x.Seo != null ? x.Seo.Description : null }).ToListAsync(ct);
        var rows = products.Concat(categories).ToList();
        bool uniqueTitle = !rows.Any(x => Normalize(EffectiveTitle(x.Name, new SeoInput(Title: x.Title), settings)) == Normalize(target.EffectiveTitle));
        bool uniqueDescription = target.EffectiveDescription.Length > 0 && !rows.Any(x => !string.IsNullOrWhiteSpace(x.Description) && Normalize(x.Description) == Normalize(target.EffectiveDescription));
        return Analyze(draft, settings, descriptions, uniqueTitle, uniqueDescription);
    }
}
