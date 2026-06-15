using Domain.Common;
using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// Represents a customer order and its payment state.
/// </summary>
public class Order : AuditableEntity
{
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
    public string CurrencyCode { get; set; } = "IRR";

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
    /// Recalculates the order totals from the current line items.
    /// </summary>
    public void RecalculateTotals()
    {
        Subtotal = Items.Sum(item => item.LineTotal);
        TotalAmount = Math.Max(0, Subtotal + ShippingCost - DiscountAmount);
    }
}
