namespace Application.Auth;

/// <summary>Validates optional WGS84 coordinates before address state is changed.</summary>
internal static class AddressCoordinates
{
    /// <summary>Returns an error for an incomplete or invalid coordinate pair, otherwise null.</summary>
    public static string? Validate(double? latitude, double? longitude)
    {
        if (latitude.HasValue != longitude.HasValue)
        {
            return "Latitude and longitude must be supplied together.";
        }

        if (latitude is double lat && (!double.IsFinite(lat) || lat < -90 || lat > 90))
        {
            return "Latitude must be a finite number between -90 and 90.";
        }

        if (longitude is double lon && (!double.IsFinite(lon) || lon < -180 || lon > 180))
        {
            return "Longitude must be a finite number between -180 and 180.";
        }

        return null;
    }
}
