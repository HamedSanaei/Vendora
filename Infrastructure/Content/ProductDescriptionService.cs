using System.Text.RegularExpressions;
using AngleSharp.Dom;
using AngleSharp.Html.Parser;
using Application.Interfaces;
using Ganss.Xss;

namespace Infrastructure.Content;

/// <summary>Sanitizes article markup using an explicit HTML/CSS allow list and locally owned image URLs.</summary>
public sealed partial class ProductDescriptionService : IProductDescriptionService
{
    private readonly HtmlSanitizer _sanitizer = new();

    /// <summary>Creates a scoped sanitizer; no mutable sanitizer instance is shared between requests.</summary>
    public ProductDescriptionService()
    {
        _sanitizer.AllowedTags.Clear();
        _sanitizer.AllowedTags.UnionWith(["p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s",
            "blockquote", "ul", "ol", "li", "a", "img", "span", "hr"]);
        _sanitizer.AllowedAttributes.Clear();
        _sanitizer.AllowedAttributes.UnionWith(["href", "src", "alt", "title", "style", "dir"]);
        _sanitizer.AllowedCssProperties.Clear();
        _sanitizer.AllowedCssProperties.UnionWith(["font-family", "font-size", "color", "background-color", "text-align", "line-height"]);
        _sanitizer.AllowedAtRules.Clear();
        _sanitizer.AllowedSchemes.Clear();
        _sanitizer.AllowedSchemes.UnionWith(["https", "http", "mailto"]);
    }

    /// <inheritdoc />
    public string? Sanitize(string? content)
    {
        if (string.IsNullOrWhiteSpace(content)) return null;
        if (!Markup().IsMatch(content)) return content.Trim();
        using var document = new HtmlParser().ParseDocument(_sanitizer.Sanitize(content));
        foreach (var element in document.Body!.QuerySelectorAll("*"))
        {
            if (element.HasAttribute("dir") && element.GetAttribute("dir") is not ("rtl" or "ltr" or "auto"))
                element.RemoveAttribute("dir");
            if (element.LocalName == "img")
            {
                // Never embed third-party tracking, SVG, data URLs, or client-provided filesystem paths.
                if (!OwnedImage().IsMatch(element.GetAttribute("src") ?? "")) { element.Remove(); continue; }
                element.SetAttribute("loading", "lazy");
                element.SetAttribute("decoding", "async");
            }
            if (element.LocalName == "a")
            {
                string href = element.GetAttribute("href") ?? "";
                bool local = (href.StartsWith("/fa/", StringComparison.Ordinal) || href.StartsWith("/en/", StringComparison.Ordinal))
                    && !href.Contains('\\') && !href.Any(char.IsControl);
                if (!local && (!Uri.TryCreate(href, UriKind.Absolute, out var uri)
                    || uri.Scheme is not ("https" or "http" or "mailto"))) element.RemoveAttribute("href");
                element.SetAttribute("rel", "noopener noreferrer");
            }
            var styles = (element.GetAttribute("style") ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries)
                .Select(style => style.Split(':', 2)).Where(pair => pair.Length == 2)
                .Where(pair => IsAllowedStyle(pair[0].Trim().ToLowerInvariant(), pair[1].Trim()))
                .Select(pair => $"{pair[0].Trim()}: {pair[1].Trim()}");
            string safeStyle = string.Join("; ", styles);
            if (safeStyle.Length == 0) element.RemoveAttribute("style"); else element.SetAttribute("style", safeStyle);
        }
        if (string.IsNullOrWhiteSpace(document.Body.TextContent) && document.Body.QuerySelector("img") is null) return null;
        return document.Body.InnerHtml.Trim();
    }

    /// <inheritdoc />
    public string? Excerpt(string? content, int maxLength = 320)
    {
        if (string.IsNullOrWhiteSpace(content)) return null;
        string text = content;
        if (Markup().IsMatch(content))
        {
            using var document = new HtmlParser().ParseDocument(Sanitize(content) ?? "");
            foreach (var block in document.Body!.QuerySelectorAll("p,h2,h3,h4,li,blockquote,br"))
                block.Append(document.CreateTextNode(" "));
            text = document.Body.TextContent;
        }
        text = Whitespace().Replace(text, " ").Trim();
        if (text.Length <= maxLength) return text;
        int end = maxLength;
        if (char.IsHighSurrogate(text[end - 1])) end--;
        return text[..end] + "…";
    }

    /// <summary>Restricts presentation to the same finite font, size, color, and alignment choices offered by the editor.</summary>
    private static bool IsAllowedStyle(string name, string value) => name switch
    {
        "font-family" => value.Trim('"', '\'').ToLowerInvariant() is "vazirmatn" or "tahoma" or "arial",
        "font-size" => value is "14px" or "16px" or "18px" or "20px" or "24px" or "28px" or "32px",
        "text-align" => value is "left" or "right" or "center" or "justify" or "start" or "end",
        "line-height" => value is "1.5" or "1.8" or "2",
        "color" or "background-color" => SafeColor().IsMatch(value),
        _ => false
    };

    [GeneratedRegex(@"<[a-zA-Z!/][^>]*>")]
    private static partial Regex Markup();
    [GeneratedRegex(@"^/uploads/products/[a-fA-F0-9]{32}\.(jpg|jpeg|png|webp)$")]
    private static partial Regex OwnedImage();
    [GeneratedRegex(@"^(#[a-fA-F0-9]{3,8}|rgba?\([\d\s,.%]+\))$")]
    private static partial Regex SafeColor();
    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
