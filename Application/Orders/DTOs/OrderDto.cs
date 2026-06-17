namespace Application.Orders.DTOs;

/// <summary>
/// Represents an order summary.
/// </summary>
public sealed record OrderDto(
    Guid Id,
    string OrderNumber,
    string Status,
    string PaymentStatus,
    decimal Subtotal,
    decimal ShippingCost,
    decimal DiscountAmount,
    decimal TotalAmount,
    IReadOnlyList<OrderItemDto> Items);
