using Application.StoreSettings;

namespace Application.Interfaces;

/// <summary>Extracts a provider-owned link and image from an untrusted badge snippet without executing it.</summary>
public interface IEnamadCodeParser
{
    /// <summary>Returns normalized badge data, or null when the markup is not a supported official badge.</summary>
    EnamadBadge? Parse(string code);
}
