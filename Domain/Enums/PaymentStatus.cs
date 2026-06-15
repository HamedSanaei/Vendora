namespace Domain.Enums;

/// <summary>
/// Represents the verification and settlement state of a payment.
/// </summary>
public enum PaymentStatus
{
    Pending = 0,
    Redirected = 1,
    Verified = 2,
    Failed = 3,
    Cancelled = 4
}
