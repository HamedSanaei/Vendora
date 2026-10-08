using System.Globalization;
using Application.Addresses;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>Resolves selected delivery coordinates without creating or updating an account address.</summary>
[ApiController]
[Authorize]
[Route("api/account/addresses/reverse-geocode")]
public sealed class AddressLocationController(ISender mediator) : ControllerBase
{
    /// <summary>Returns the provider address or a safe, stable lookup error for the selected point.</summary>
    [HttpGet]
    public async Task<ActionResult> GetAddress(
        [FromQuery] string? latitude,
        [FromQuery] string? longitude,
        CancellationToken cancellationToken)
    {
        if (!TryParseCoordinate(latitude, out var parsedLatitude)
            || !TryParseCoordinate(longitude, out var parsedLongitude))
        {
            return InvalidCoordinates();
        }

        var result = await mediator.Send(new ReverseGeocode.Query(parsedLatitude, parsedLongitude), cancellationToken);
        return result.Failure switch
        {
            ReverseGeocode.Failure.None => Ok(new { formattedAddress = result.FormattedAddress }),
            ReverseGeocode.Failure.InvalidCoordinates => InvalidCoordinates(),
            ReverseGeocode.Failure.NotConfigured => StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { code = "address_lookup_not_configured", message = "Address lookup is not configured." }),
            ReverseGeocode.Failure.NotFound => NotFound(
                new { code = "address_lookup_not_found", message = "No address was found for the selected point." }),
            _ => StatusCode(StatusCodes.Status502BadGateway,
                new { code = "address_lookup_failed", message = "Address lookup is temporarily unavailable." })
        };
    }

    /// <summary>Parses query numbers invariantly so malformed input receives the lookup error contract.</summary>
    private static bool TryParseCoordinate(string? value, out double? coordinate)
    {
        coordinate = null;
        if (value is null)
        {
            return true;
        }

        if (!double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out double parsed))
        {
            return false;
        }

        coordinate = parsed;
        return true;
    }

    /// <summary>Returns the same validation response for malformed, missing, or out-of-bounds coordinates.</summary>
    private BadRequestObjectResult InvalidCoordinates()
    {
        return BadRequest(new { code = "invalid_coordinates", message = "Select a valid delivery point in Iran." });
    }
}
