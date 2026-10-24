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

    /// <summary>Server verification timestamp; null on legacy/demo rows whose provenance is not established.</summary>
    public DateTime? VerifiedAtUtc { get; private set; }

    /// <summary>SHA-256 audit digest of genuine server-side verification evidence, never supplied by a browser.</summary>
    public string? VerificationEvidenceDigest { get; private set; }

    /// <summary>Records a verifier's successful evidence. This method does not contact or simulate a payment gateway.</summary>
    public void RecordServerVerification(string referenceId, DateTime verifiedAtUtc, string evidenceDigest)
    {
        if (Provider == PaymentProvider.Unknown || string.IsNullOrWhiteSpace(Authority) || string.IsNullOrWhiteSpace(referenceId)
            || verifiedAtUtc.Kind != DateTimeKind.Utc || evidenceDigest.Length != 64 || !evidenceDigest.All(Uri.IsHexDigit))
            throw new ArgumentException("Verified gateway evidence is required.");
        if (VerifiedAtUtc.HasValue && (ReferenceId != referenceId || VerificationEvidenceDigest != evidenceDigest))
            throw new InvalidOperationException("Payment verification evidence cannot be replaced.");
        ReferenceId = referenceId; VerifiedAtUtc ??= verifiedAtUtc; VerificationEvidenceDigest = evidenceDigest;
        Status = PaymentStatus.Verified;
    }
}
