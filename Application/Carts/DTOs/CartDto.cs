namespace Application.Carts.DTOs;

/// <summary>
/// Represents a shopping cart summary.
/// </summary>
public sealed record CartDto(
    Guid Id,
    Guid? UserId,
    IReadOnlyList<CartItemDto> Items,
    decimal TotalAmount);
