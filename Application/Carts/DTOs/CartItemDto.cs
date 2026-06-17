namespace Application.Carts.DTOs;

/// <summary>
/// Represents a single item in a shopping cart.
/// </summary>
public sealed record CartItemDto(
    Guid ProductId,
    string ProductTitle,
    decimal UnitPrice,
    int Quantity,
    decimal LineTotal);
