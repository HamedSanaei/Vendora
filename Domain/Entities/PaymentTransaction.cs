using Domain.Common;
using Domain.Enums;

namespace Domain.Entities;

/// <summary>
/// Represents a payment gateway attempt associated with an order.
/// </summary>
public class PaymentTransaction : AuditableEntity
{
    /// <summary>
    /// Gets or sets the owning order identifier.
    /// </summary>
    public Guid OrderId { get; set; }

    /// <summary>
    /// Gets or sets the parent order.
    /// </summary>
    public Order Order { get; set; } = null!;

    /// <summary>
    /// Gets or sets the payment provider.
    /// </summary>
    public PaymentProvider Provider { get; set; } = PaymentProvider.Unknown;

    /// <summary>
    /// Gets or sets the provider-specific authority or token.
    /// </summary>
    public string? Authority { get; set; }

    /// <summary>
    /// Gets or sets the provider-specific reference identifier.
    /// </summary>
    public string? ReferenceId { get; set; }

    /// <summary>
    /// Gets or sets the payment amount.
    /// </summary>
    public decimal Amount { get; set; }

    /// <summary>
    /// Gets or sets the current payment state.
    /// </summary>
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;

    /// <summary>
    /// Gets or sets an optional failure reason.
    /// </summary>
    public string? FailureReason { get; set; }
}
