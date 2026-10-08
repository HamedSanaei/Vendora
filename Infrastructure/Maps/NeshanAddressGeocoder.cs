using System.Globalization;
using System.Text.Json;
using Application.Addresses;
using Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Maps;

/// <summary>Calls Neshan reverse geocoding with a private service key read only on the server.</summary>
public sealed class NeshanAddressGeocoder(HttpClient httpClient, IConfiguration configuration) : IAddressGeocoder
{
    /// <inheritdoc />
    public async Task<ReverseGeocode.Result> ReverseAsync(double latitude, double longitude, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        string? apiKey = configuration["Neshan:ServiceApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey) || !apiKey.StartsWith("service.", StringComparison.Ordinal))
        {
            return new ReverseGeocode.Result(ReverseGeocode.Failure.NotConfigured);
        }

        string uri = "v5/reverse?lat=" + latitude.ToString("R", CultureInfo.InvariantCulture)
            + "&lng=" + longitude.ToString("R", CultureInfo.InvariantCulture);
        using var request = new HttpRequestMessage(HttpMethod.Get, uri);
        try
        {
            request.Headers.Add("Api-Key", apiKey);
        }
        catch (FormatException)
        {
            return new ReverseGeocode.Result(ReverseGeocode.Failure.NotConfigured);
        }

        try
        {
            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                return new ReverseGeocode.Result(ReverseGeocode.Failure.Unavailable);
            }

            using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object
                || !root.TryGetProperty("status", out var status)
                || status.ValueKind != JsonValueKind.String
                || status.GetString() != "OK")
            {
                return new ReverseGeocode.Result(ReverseGeocode.Failure.Unavailable);
            }

            if (!root.TryGetProperty("formatted_address", out var address) || address.ValueKind == JsonValueKind.Null)
            {
                return new ReverseGeocode.Result(ReverseGeocode.Failure.NotFound);
            }

            if (address.ValueKind != JsonValueKind.String)
            {
                return new ReverseGeocode.Result(ReverseGeocode.Failure.Unavailable);
            }

            string? formattedAddress = address.GetString();
            return string.IsNullOrWhiteSpace(formattedAddress)
                ? new ReverseGeocode.Result(ReverseGeocode.Failure.NotFound)
                : new ReverseGeocode.Result(ReverseGeocode.Failure.None, formattedAddress);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return new ReverseGeocode.Result(ReverseGeocode.Failure.Unavailable);
        }
        catch (HttpRequestException)
        {
            return new ReverseGeocode.Result(ReverseGeocode.Failure.Unavailable);
        }
        catch (IOException)
        {
            return new ReverseGeocode.Result(ReverseGeocode.Failure.Unavailable);
        }
        catch (JsonException)
        {
            return new ReverseGeocode.Result(ReverseGeocode.Failure.Unavailable);
        }
    }
}
