using System.Globalization;

namespace Domain.Common;

/// <summary>Normalizes public code searches without changing stored identifiers or URL slugs.</summary>
public static class ProductCodeSearch
{
    /// <summary>Converts Persian and Arabic digits to ASCII and trims the user's search text.</summary>
    public static string Normalize(string value) => string.Concat(value.Trim().Select(c => c switch
    {
        >= '\u06F0' and <= '\u06F9' => (char)('0' + c - '\u06F0'),
        >= '\u0660' and <= '\u0669' => (char)('0' + c - '\u0660'),
        _ => c
    }));

    /// <summary>Recognizes a complete product number, never treating a fragment as an exact match.</summary>
    public static int? Parse(string value) => int.TryParse(Normalize(value), NumberStyles.None,
        CultureInfo.InvariantCulture, out int code) && code >= 100 ? code : null;
}
