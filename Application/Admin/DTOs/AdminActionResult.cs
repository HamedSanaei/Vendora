namespace Application.Admin.DTOs;

/// <summary>
/// Represents a lightweight command result for admin mutations.
/// </summary>
public sealed record AdminActionResult(bool Succeeded, string? Error)
{
    /// <summary>Creates a successful result.</summary>
    public static AdminActionResult Ok() => new(true, null);

    /// <summary>Creates a failed result.</summary>
    public static AdminActionResult Fail(string error) => new(false, error);
}
