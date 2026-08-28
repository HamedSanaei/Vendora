using Domain.Common;

namespace Domain.Entities;

/// <summary>
/// Represents an email captured from the storefront newsletter/signup call-to-action.
/// </summary>
public class EmailSubscription : AuditableEntity
{
    /// <summary>
    /// Gets or sets the normalized subscriber email address.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the locale route where the email was captured.
    /// </summary>
    public string? SourceLocale { get; set; }

    /// <summary>
    /// Gets or sets whether the subscription is active.
    /// </summary>
    public bool IsActive { get; set; } = true;
}
