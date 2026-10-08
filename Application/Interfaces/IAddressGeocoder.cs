using Application.Addresses;

namespace Application.Interfaces;

/// <summary>Resolves a validated delivery point to an address using a server-side provider.</summary>
public interface IAddressGeocoder
{
    /// <summary>Returns the provider address or an expected lookup failure, preserving caller cancellation.</summary>
    Task<ReverseGeocode.Result> ReverseAsync(double latitude, double longitude, CancellationToken cancellationToken);
}
