using Domain.Enums;

namespace Application.Admin.DTOs;

/// <summary>
/// Represents a user account row in the admin panel.
/// </summary>
public sealed record AdminUserDto(Guid Id, string FullName, string Email, string? PhoneNumber, UserRole Role);
