namespace Application.Orders.DTOs;

/// <summary>
/// Represents the shipping address snapshot captured on an order.
/// </summary>
public sealed record OrderShippingAddressDto(
    Guid? AddressId,
    string RecipientName,
    string PhoneNumber,
    string Province,
    string City,
    string StreetAddress,
    string? Plaque,
    string? Unit,
    string PostalCode);

/// <summary>
/// Represents an order summary.
/// </summary>
public sealed record OrderDto(
    Guid Id,
    string OrderNumber,
    DateTime CreatedAtUtc,
    string Status,
    string PaymentStatus,
    decimal Subtotal,
    decimal ShippingCost,
    decimal DiscountAmount,
    decimal TotalAmount,
    OrderShippingAddressDto ShippingAddress,
    IReadOnlyList<OrderItemDto> Items);
