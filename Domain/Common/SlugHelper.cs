using System.Globalization;
using System.Text;

namespace Domain.Common;

/// <summary>
/// Creates predictable URL slugs for products and categories.
/// </summary>
public static class SlugHelper
{
    /// <summary>
    /// Converts a source string into a lowercase ASCII slug.
    /// </summary>
    /// <param name="source">The text to normalize.</param>
    /// <returns>A URL-friendly slug.</returns>
    public static string ToSlug(string source)
    {
        if (string.IsNullOrWhiteSpace(source))
        {
            return string.Empty;
        }

        string normalized = source.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var builder = new StringBuilder(normalized.Length);
        bool previousDash = false;

        foreach (char character in normalized)
        {
            UnicodeCategory category = CharUnicodeInfo.GetUnicodeCategory(character);
            if (category == UnicodeCategory.NonSpacingMark)
            {
                continue;
            }

            if (char.IsLetterOrDigit(character))
            {
                builder.Append(character);
                previousDash = false;
                continue;
            }

            if (!previousDash && builder.Length > 0)
            {
                builder.Append('-');
                previousDash = true;
            }
        }

        return builder.ToString().Trim('-');
    }
}
