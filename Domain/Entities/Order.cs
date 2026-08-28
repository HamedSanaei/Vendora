using Domain.Common;
using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// Represents a customer order and its payment state.
/// </summary>
public class Order : AuditableEntity
{
    private static readonly IReadOnlyDictionary<OrderStatus, OrderStatus[]> AllowedTransitions =
        new Dictionary<OrderStatus, OrderStatus[]>
        {
            [OrderStatus.PendingPayment] = [OrderStatus.Cancelled],
            [OrderStatus.Paid] = [OrderStatus.Processing, OrderStatus.Cancelled],
            [OrderStatus.Processing] = [OrderStatus.Packed, OrderStatus.Cancelled],
            [OrderStatus.Packed] = [OrderStatus.Shipped, OrderStatus.Cancelled],
            [OrderStatus.Shipped] = [OrderStatus.Delivered],
            [OrderStatus.Delivered] = [],
            [OrderStatus.Cancelled] = [],
            [OrderStatus.Refunded] = []
        };

    /// <summary>
    /// Gets or sets the optional customer identifier.
    /// </summary>
    public Guid? UserId { get; set; }

    /// <summary>
    /// Gets or sets the order number shown to customers.
    /// </summary>
    public string OrderNumber { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the current order status.
    /// </summary>
    public OrderStatus Status { get; set; } = OrderStatus.PendingPayment;

    /// <summary>
    /// Gets or sets the payment status.
    /// </summary>
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pending;

    /// <summary>
    /// Gets or sets the order currency code.
    /// </summary>
    public string CurrencyCode { get; set; } = "TOMAN";

    /// <summary>
    /// Gets or sets the customer address identifier selected at checkout.
    /// </summary>
    public Guid? ShippingAddressId { get; set; }

    /// <summary>
    /// Gets or sets the recipient name snapshot captured at checkout.
    /// </summary>
    public string ShippingRecipientName { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the recipient phone snapshot captured at checkout.
    /// </summary>
    public string ShippingPhoneNumber { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the province snapshot captured at checkout.
    /// </summary>
    public string ShippingProvince { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the city snapshot captured at checkout.
    /// </summary>
    public string ShippingCity { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the street address snapshot captured at checkout.
    /// </summary>
    public string ShippingStreetAddress { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the plaque snapshot captured at checkout.
    /// </summary>
    public string? ShippingPlaque { get; set; }

    /// <summary>
    /// Gets or sets the unit snapshot captured at checkout.
    /// </summary>
    public string? ShippingUnit { get; set; }

    /// <summary>
    /// Gets or sets the postal code snapshot captured at checkout.
    /// </summary>
    public string ShippingPostalCode { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the subtotal at the time the order was created.
    /// </summary>
    public decimal Subtotal { get; set; }

    /// <summary>
    /// Gets or sets the shipping amount.
    /// </summary>
    public decimal ShippingCost { get; set; }

    /// <summary>
    /// Gets or sets the discount amount.
    /// </summary>
    public decimal DiscountAmount { get; set; }

    /// <summary>
    /// Gets or sets the final amount due.
    /// </summary>
    public decimal TotalAmount { get; set; }

    /// <summary>
    /// Gets the order items.
    /// </summary>
    public List<OrderItem> Items { get; set; } = [];

    /// <summary>
    /// Returns the lifecycle states that can follow the current order state.
    /// </summary>
    /// <returns>A read-only collection of valid next states.</returns>
    public IReadOnlyList<OrderStatus> GetAllowedTransitions()
    {
        return AllowedTransitions.TryGetValue(Status, out var transitions) ? transitions : [];
    }

    /// <summary>
    /// Advances the order to a valid next lifecycle state and records the update time.
    /// </summary>
    /// <param name="nextStatus">The requested next state.</param>
    /// <returns><see langword="true"/> when the transition is valid and applied.</returns>
    public bool TryChangeStatus(OrderStatus nextStatus)
    {
        if (!GetAllowedTransitions().Contains(nextStatus))
        {
            return false;
        }

        Status = nextStatus;
        Touch();
        return true;
    }

    /// <summary>
    /// Recalculates the order totals from the current line items.
    /// </summary>
    public void RecalculateTotals()
    {
        Subtotal = Items.Sum(item => item.LineTotal);
        TotalAmount = Math.Max(0, Subtotal + ShippingCost - DiscountAmount);
    }
}
