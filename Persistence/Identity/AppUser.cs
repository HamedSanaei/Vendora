using Microsoft.AspNetCore.Identity;

namespace Persistence.Identity;

/// <summary>
/// Represents an authenticated Vendora user managed by ASP.NET Core Identity.
/// </summary>
public sealed class AppUser : IdentityUser<Guid>
{
    /// <summary>
    /// Gets or sets the user's display name.
    /// </summary>
    public string FullName { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets an optional short customer profile biography.
    /// </summary>
    public string? Bio { get; set; }
}
