using AngleSharp.Html.Parser;
using Application.Interfaces;
using Application.StoreSettings;

namespace Infrastructure.Content;

/// <summary>Reads inert HTML using the existing parser and restricts both destinations to official badge hosts.</summary>
public sealed class EnamadCodeParser : IEnamadCodeParser
{
    /// <inheritdoc />
    public EnamadBadge? Parse(string code)
    {
        if (string.IsNullOrWhiteSpace(code) || code.Length > 10000) return null;
        using var document = new HtmlParser().ParseDocument(code);
        if (document.QuerySelector("script,iframe,object,embed,base,style,link") is not null) return null;
        var anchors = document.QuerySelectorAll("a");
        var images = document.QuerySelectorAll("img");
        if (anchors.Length != 1 || images.Length != 1 || !anchors[0].Contains(images[0])) return null;
        string? href = anchors[0].GetAttribute("href");
        string? image = images[0].GetAttribute("src");
        return Allowed(href, false) && Allowed(image, true) ? new(href!, image!) : null;
    }

    /// <summary>Validates exact HTTPS hosts, paths and bounded URLs; no network request is performed.</summary>
    private static bool Allowed(string? value, bool image)
    {
        if (value is null || value.Length > 1500 || value.Any(char.IsControl) || value.Contains('\\')
            || !Uri.TryCreate(value, UriKind.Absolute, out var uri) || uri.Scheme != "https"
            || uri.UserInfo.Length != 0 || !uri.IsDefaultPort || uri.Fragment.Length != 0) return false;
        return image
            ? uri.Host is "trustseal.enamad.ir" or "logo.enamad.ir" && uri.AbsolutePath == "/logo.aspx"
            : uri.Host == "trustseal.enamad.ir" && uri.AbsolutePath == "/";
    }
}
