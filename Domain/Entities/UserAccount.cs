using Domain.Common;
using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// Represents a customer or administrator account.
/// </summary>
public class UserAccount : AuditableEntity
{
    /// <summary>
    /// Gets or sets the display name.
    /// </summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the email address.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the phone number.
    /// </summary>
    public string? PhoneNumber { get; set; }

    /// <summary>
    /// Gets or sets the role.
    /// </summary>
    public UserRole Role { get; set; } = UserRole.Customer;
}
