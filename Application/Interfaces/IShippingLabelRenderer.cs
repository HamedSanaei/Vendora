namespace Application.Interfaces;

/// <summary>Contains only logistics data permitted on the outside of a parcel, never order items or money.</summary>
public sealed record ShippingLabelData(Guid OrderId, string OrderNumber, string RecipientName, string RecipientPhone,
    string Province, string City, string StreetAddress, string? Plaque, string? Unit, string PostalCode,
    string SenderName, string SenderAddress, string SupportPhone, string ShippingMethod, string ShippingTerms);

/// <summary>Renders one portrait A5 page per validated order entirely in memory.</summary>
public interface IShippingLabelRenderer
{
    /// <summary>Preserves input order; fails the entire request if any label cannot fit without truncation.</summary>
    Task<byte[]> RenderAsync(IReadOnlyList<ShippingLabelData> labels, CancellationToken cancellationToken);
}
