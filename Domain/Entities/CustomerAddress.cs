using Domain.Common;

namespace Domain.Entities;

/// <summary>
/// Represents an Iranian shipping address owned by a customer account.
/// </summary>
public class CustomerAddress : AuditableEntity
{
    /// <summary>Gets or sets the Identity user identifier that owns this address.</summary>
    public Guid UserId { get; set; }

    /// <summary>Gets or sets a user-friendly label such as Home or Work.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>Gets or sets the recipient full name for deliveries.</summary>
    public string RecipientName { get; set; } = string.Empty;

    /// <summary>Gets or sets the recipient Iranian mobile number.</summary>
    public string PhoneNumber { get; set; } = string.Empty;

    /// <summary>Gets or sets the Iranian province.</summary>
    public string Province { get; set; } = string.Empty;

    /// <summary>Gets or sets the city.</summary>
    public string City { get; set; } = string.Empty;

    /// <summary>Gets or sets the street address details.</summary>
    public string StreetAddress { get; set; } = string.Empty;

    /// <summary>Gets or sets the optional building plaque number.</summary>
    public string? Plaque { get; set; }

    /// <summary>Gets or sets the optional unit number.</summary>
    public string? Unit { get; set; }

    /// <summary>Gets or sets the 10-digit Iranian postal code.</summary>
    public string PostalCode { get; set; } = string.Empty;

    /// <summary>Gets or sets whether this address is the customer's default address.</summary>
    public bool IsDefault { get; set; }
}
