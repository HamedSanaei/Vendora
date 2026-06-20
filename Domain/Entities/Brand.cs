using Domain.Common;

namespace Domain.Entities;

/// <summary>
/// Represents a product brand managed by the admin panel.
/// </summary>
public class Brand : AuditableEntity
{
    /// <summary>Gets or sets the display name.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>Gets or sets the SEO-friendly slug.</summary>
    public string Slug { get; set; } = string.Empty;

    /// <summary>Gets or sets the optional logo URL.</summary>
    public string? LogoUrl { get; set; }

    /// <summary>Gets or sets the optional contact email.</summary>
    public string? Email { get; set; }

    /// <summary>Gets or sets the optional website URL.</summary>
    public string? Website { get; set; }

    /// <summary>Gets or sets the optional description.</summary>
    public string? Description { get; set; }

    /// <summary>Gets or sets the optional location.</summary>
    public string? Location { get; set; }

    /// <summary>Gets or sets whether the brand is active.</summary>
    public bool IsActive { get; set; } = true;
}
