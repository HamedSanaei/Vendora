namespace Application.Orders.DTOs;

/// <summary>
/// Represents an item within an order.
/// </summary>
public sealed record OrderItemDto(
    Guid ProductId,
    string ProductTitle,
    decimal UnitPrice,
    int Quantity,
    decimal LineTotal);
