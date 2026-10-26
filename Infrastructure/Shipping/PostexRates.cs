using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Accounting;
using Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Shipping;

/// <summary>Bounded single-flight read cache; failures are removed and never become zero-price quotations.</summary>
public sealed class PostexReadCache
{
    private readonly ConcurrentDictionary<string, (DateTime Expiry, Lazy<Task<JsonElement>> Value)> _entries = new();

    /// <summary>Shares an in-flight request while allowing individual callers to cancel their own wait.</summary>
    public async Task<JsonElement> ReadAsync(string key, TimeSpan ttl, Func<Task<JsonElement>> load, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        foreach (var pair in _entries.Where(x => x.Value.Expiry <= now)) _entries.TryRemove(pair);
        if (_entries.Count >= 512 && !_entries.ContainsKey(key)) throw new AccountingException("POSTEX_BUSY", 503);
        var entry = _entries.GetOrAdd(key, _ => (now.Add(ttl), new Lazy<Task<JsonElement>>(load)));
        try { return await entry.Value.Value.WaitAsync(ct); }
        catch { if (entry.Value.IsValueCreated && entry.Value.Value.IsFaulted) _entries.TryRemove(new(key, entry)); throw; }
    }
}

/// <summary>Read-only Postex v1 adapter, based on vendor plugin 1.6.1; never books parcels or touches wallets.</summary>
public sealed class PostexRates(IHttpClientFactory clients, IConfiguration configuration, PostexReadCache cache) : IPostexRates
{
    public bool Configured => !string.IsNullOrWhiteSpace(configuration["Shipping:Postex:ApiKey"]);

    /// <summary>Obtains a complete rate for one configured postal service; all carrier money is in IRR.</summary>
    public async Task<decimal> QuoteAsync(PostexRateRequest request, CancellationToken ct)
    {
        var p = request.Policy;
        var box = request.Package;
        var payload = new {
            from_city_code = p.OriginCityCode, collection_type = p.CollectionType, lat = p.OriginLatitude, lon = p.OriginLongitude,
            courier = new { courier_code = p.CourierCode, service_type = p.ServiceType },
            parcels = new[] { new { custom_parcel_id = "", to_city_code = request.DestinationCityCode, payment_type = p.PaymentType,
                parcel_properties = new { height = box.HeightCm, width = box.WidthCm, length = box.LengthCm, box_type_id = box.BoxTypeId,
                    is_fragile = false, is_liquid = false, total_weight = request.WeightGrams, total_value = request.DeclaredValueToman * 10m, total_value_currency = "IRR" } } },
            value_added_service = new { handling_fee = 0, request_label = false, request_packaging = false, request_sms_notification = false,
                optional_insurance = false, request_email_notification = false, print_logo = false },
            channel = "api", appName = "Vendora"
        };
        var json = JsonSerializer.Serialize(payload);
        var key = "quote:" + p.Version + ":" + Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(json)));
        var response = await cache.ReadAsync(key, TimeSpan.FromMinutes(10), async () => {
            var value = await SendAsync("shipping/quotes", payload);
            _ = ReadCostToman(value); // Invalid responses must fault the shared task and be evicted so retry can recover.
            return value;
        }, ct);
        return ReadCostToman(response);
    }

    /// <summary>Only public reference catalogs are allowed, cached for a day to avoid per-customer list downloads.</summary>
    public Task<JsonElement> ReferenceAsync(string resource, CancellationToken ct)
    {
        string path = resource switch { "cities" => "locality/cities/all", "boxes" => "common/boxes", "methods" => "shipping-methods",
            "payments" => "common/payment-methods", _ => throw new AccountingException("INVALID_REFERENCE", 400) };
        return cache.ReadAsync("reference:" + path, TimeSpan.FromDays(1), async () => {
            var value = await SendAsync(path, null);
            if (Application.Shipping.PostexReferences.Items(resource, value).Count == 0) throw new AccountingException("POSTEX_INVALID_REFERENCE", 503);
            return value;
        }, ct);
    }

    /// <summary>Sums service, separately enumerated extras and pickup once, converting IRR to Toman without floating point.</summary>
    public static decimal ReadCostToman(JsonElement response)
    {
        if (response.ValueKind != JsonValueKind.Object) throw new AccountingException("POSTEX_INVALID_QUOTE", 503);
        if (response.TryGetProperty("isSuccess", out var success) && success.ValueKind == JsonValueKind.False)
            throw new AccountingException("POSTEX_INVALID_QUOTE", 503);
        if (!response.TryGetProperty("shipping_prices", out var parcels) || parcels.ValueKind != JsonValueKind.Array || parcels.GetArrayLength() != 1 ||
            parcels[0].ValueKind != JsonValueKind.Object || !parcels[0].TryGetProperty("service_price", out var services) || services.ValueKind != JsonValueKind.Array || services.GetArrayLength() != 1)
            throw new AccountingException("POSTEX_INVALID_QUOTE", 503);
        decimal Number(JsonElement obj, string field, bool optional = false)
        {
            if (obj.ValueKind != JsonValueKind.Object) throw new AccountingException("POSTEX_INVALID_QUOTE", 503);
            if (obj.TryGetProperty(field, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var n) && n >= 0) return n;
            if (optional && !obj.TryGetProperty(field, out _)) return 0;
            throw new AccountingException("POSTEX_INVALID_QUOTE", 503);
        }
        decimal total = Number(services[0], "totalPrice") + Number(response, "pickup_price", true);
        if (parcels[0].TryGetProperty("value_added_service_price", out var extras))
        {
            if (extras.ValueKind != JsonValueKind.Array) throw new AccountingException("POSTEX_INVALID_QUOTE", 503);
            foreach (var extra in extras.EnumerateArray())
            {
                if (extra.ValueKind != JsonValueKind.Object || !extra.TryGetProperty("price", out var price)) throw new AccountingException("POSTEX_INVALID_QUOTE", 503);
                total += Number(price, "totalPrice");
            }
        }
        if (total <= 0) throw new AccountingException("POSTEX_INVALID_QUOTE", 503);
        return total / 10m;
    }

    /// <summary>Sends a fixed-origin request; secrets and raw vendor errors are never logged or returned.</summary>
    private async Task<JsonElement> SendAsync(string path, object? body)
    {
        if (!Configured) throw new AccountingException("POSTEX_NOT_CONFIGURED", 503);
        try
        {
            using var request = new HttpRequestMessage(body is null ? HttpMethod.Get : HttpMethod.Post, "https://api.postex.ir/api/v1/" + path);
            request.Headers.Add("x-api-key", configuration["Shipping:Postex:ApiKey"]);
            if (body is not null) request.Content = JsonContent.Create(body);
            using var response = await clients.CreateClient("PostexRates").SendAsync(request, CancellationToken.None);
            if (!response.IsSuccessStatusCode) throw new AccountingException("POSTEX_UNAVAILABLE", 503);
            return await response.Content.ReadFromJsonAsync<JsonElement>();
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or JsonException)
        { throw new AccountingException("POSTEX_UNAVAILABLE", 503); }
    }
}
