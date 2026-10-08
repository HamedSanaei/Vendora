using Application.Auth;
using Application.Interfaces;
using MediatR;

namespace Application.Addresses;

/// <summary>Looks up an address for a selected delivery point without changing saved addresses.</summary>
public static class ReverseGeocode
{
    /// <summary>Identifies expected validation, configuration, and provider outcomes.</summary>
    public enum Failure { None, InvalidCoordinates, NotConfigured, NotFound, Unavailable }

    /// <summary>Contains the provider's unmodified address on a successful lookup.</summary>
    public sealed record Result(Failure Failure, string? FormattedAddress = null);

    /// <summary>Requests an address for a required latitude and longitude pair.</summary>
    public sealed record Query(double? Latitude, double? Longitude) : IRequest<Result>;

    /// <summary>Validates the delivery-point bounds before calling the address provider.</summary>
    public sealed class Handler(IAddressGeocoder geocoder) : IRequestHandler<Query, Result>
    {
        /// <inheritdoc />
        public Task<Result> Handle(Query request, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (AddressCoordinates.Validate(request.Latitude, request.Longitude) is not null
                || request.Latitude is not double latitude
                || request.Longitude is not double longitude
                || latitude < 25 || latitude > 40
                || longitude < 44 || longitude > 63.5)
            {
                return Task.FromResult(new Result(Failure.InvalidCoordinates));
            }

            return geocoder.ReverseAsync(latitude, longitude, cancellationToken);
        }
    }
}
