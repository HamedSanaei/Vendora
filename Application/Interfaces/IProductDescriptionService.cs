namespace Application.Interfaces;

/// <summary>Normalizes product articles without trusting HTML supplied by an administrator or legacy data.</summary>
public interface IProductDescriptionService
{
    /// <summary>Returns allow-listed HTML, preserves legacy plain text, and removes executable content.</summary>
    string? Sanitize(string? content);

    /// <summary>Returns a compact plain-text excerpt suitable for catalog cards and persisted cart snapshots.</summary>
    string? Excerpt(string? content, int maxLength = 320);
}
