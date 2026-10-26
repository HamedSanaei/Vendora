using System.Text.Json;
using Domain.Entities;

namespace Application.Interfaces;

/// <summary>Read-only carrier pricing input, using grams, centimetres and a Toman declared value.</summary>
public sealed record PostexRateRequest(ShippingPolicy Policy, ShippingPackage Package, string DestinationCityCode,
    int WeightGrams, decimal DeclaredValueToman);

/// <summary>Isolates carrier HTTP and secrets from commerce; no shipment booking or wallet operations.</summary>
public interface IPostexRates
{
    bool Configured { get; }
    Task<decimal> QuoteAsync(PostexRateRequest request, CancellationToken ct);
    Task<JsonElement> ReferenceAsync(string resource, CancellationToken ct);
}
