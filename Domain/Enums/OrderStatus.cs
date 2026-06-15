namespace Domain.Enums;

/// <summary>
/// Represents the lifecycle of a customer order.
/// </summary>
public enum OrderStatus
{
    PendingPayment = 0,
    Paid = 1,
    Processing = 2,
    Packed = 3,
    Shipped = 4,
    Delivered = 5,
    Cancelled = 6,
    Refunded = 7
}
