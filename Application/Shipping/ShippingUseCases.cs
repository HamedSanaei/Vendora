using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.Accounting;
using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Shipping;

/// <summary>Versioned administration and user-owned, persisted shipping quotations.</summary>
public static class ShippingUseCases
{
    public sealed record PublicState(bool IncludedInPrice, decimal UnitAmount, long Version);
    public sealed record Settings(ShippingPolicy Policy, IReadOnlyList<ShippingPackage> Packages, bool PostexConfigured);
    public sealed record Read(bool Admin = false) : IRequest<Settings>;
    public sealed record Save(ShippingPolicy Policy, IReadOnlyList<ShippingPackage> Packages) : IRequest<Settings>;
    public sealed record Weight(Guid ProductId, int? WeightGrams) : IRequest;
    public sealed record Reference(string Resource) : IRequest<JsonElement>;
    public sealed record CartPricing(IReadOnlyList<CartQuoteItem> Items, string? CouponCode = null) : IRequest<QuoteResult>;
    public sealed record Quote(Guid UserId, Guid AddressId, IReadOnlyList<CartQuoteItem> Items,
        string Method, string? CouponCode = null, string? DestinationCityCode = null) : IRequest<QuoteResult>;
    public sealed record QuoteResult(Guid? Id, decimal Cost, string PaymentMode, DateTime? ExpiresAtUtc, long PolicyVersion, decimal Subtotal, decimal Discount, decimal Payable);

    /// <summary>Calculates public cart/coupon totals without a destination or carrier request; browser prices are comparison values only.</summary>
    public sealed class CartPricingHandler(CartQuotation pricing) : IRequestHandler<CartPricing, QuoteResult>
    {
        public async Task<QuoteResult> Handle(CartPricing request, CancellationToken ct)
        {
            var quote = await pricing.QuoteAsync(request.Items, null, request.CouponCode, ct);
            return new(null, 0, quote.Policy.IncludedInPrice ? "free" : "undetermined", null, quote.Policy.Version,
                quote.Net + quote.Discount, quote.Discount, quote.Net);
        }
    }

    /// <summary>Reads public policy or admin configuration without exposing carrier credentials.</summary>
    public sealed class ReadHandler(AppDbContext db, IPostexRates carrier) : IRequestHandler<Read, Settings>
    {
        public async Task<Settings> Handle(Read request, CancellationToken ct)
        {
            var policy = await ShippingPricing.ReadAsync(db, ct);
            return new(policy, JsonSerializer.Deserialize<List<ShippingPackage>>(policy.PackagesJson) ?? [], carrier.Configured);
        }
    }

    /// <summary>Saves validated non-overlapping package ranges with compare-and-swap version protection.</summary>
    public sealed class SaveHandler(AppDbContext db, IPostexRates carrier, TimeProvider time) : IRequestHandler<Save, Settings>
    {
        public async Task<Settings> Handle(Save request, CancellationToken ct)
        {
            var value = request.Policy;
            if (value.UnitAmount < 0 || value.UnitAmount > 1_000_000_000m || decimal.Truncate(value.UnitAmount) != value.UnitAmount || request.Packages.Count > 100)
                throw new AccountingException("INVALID_SHIPPING_SETTINGS", 400);
            var packages = request.Packages.OrderBy(x => x.MinQuantity).ToList();
            for (int i = 0; i < packages.Count; i++)
            {
                var p = packages[i];
                if (p.MinQuantity < 1 || p.MaxQuantity < p.MinQuantity || p.MaxQuantity > 100000 || p.EmptyWeightGrams < 0 || p.EmptyWeightGrams > 100000 ||
                    p.LengthCm is < 1 or > 300 || p.WidthCm is < 1 or > 300 || p.HeightCm is < 1 or > 300 || p.BoxTypeId < 0 ||
                    (i > 0 && packages[i - 1].MaxQuantity >= p.MinQuantity)) throw new AccountingException("INVALID_PACKAGE_RANGE", 400);
            }
            if (new[] { value.OriginCityCode, value.CourierCode, value.ServiceType, value.PaymentType, value.CollectionType }.Any(x => x is null || x.Length > 100 || x.Any(char.IsControl)) ||
                value.OriginLatitude is < -90 or > 90 || value.OriginLongitude is < -180 or > 180)
                throw new AccountingException("INVALID_SHIPPING_SETTINGS", 400);
            var current = await db.ShippingPolicies.SingleOrDefaultAsync(x => x.Id == 1, ct);
            if ((current?.Version ?? 1) != value.Version) throw new AccountingException("SHIPPING_POLICY_CHANGED");
            if (current is null) { current = new ShippingPolicy(); db.ShippingPolicies.Add(current); }
            current.IncludedInPrice = value.IncludedInPrice; current.UnitAmount = value.UnitAmount;
            current.OriginCityCode = value.OriginCityCode.Trim(); current.OriginLatitude = value.OriginLatitude; current.OriginLongitude = value.OriginLongitude;
            current.CourierCode = value.CourierCode.Trim(); current.ServiceType = value.ServiceType.Trim();
            current.PaymentType = value.PaymentType.Trim(); current.CollectionType = value.CollectionType.Trim();
            current.PackagesJson = JsonSerializer.Serialize(packages); current.Version++; current.UpdatedAtUtc = time.GetUtcNow().UtcDateTime;
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException) { throw new AccountingException("SHIPPING_POLICY_CHANGED"); }
            catch (DbUpdateException) when (db.Entry(current).State == EntityState.Added) { throw new AccountingException("SHIPPING_POLICY_CHANGED"); }
            return new(current, packages, carrier.Configured);
        }
    }

    /// <summary>Changes only an actual measured weight, leaving old clients and product edits compatible.</summary>
    public sealed class WeightHandler(AppDbContext db) : IRequestHandler<Weight>
    {
        public async Task Handle(Weight request, CancellationToken ct)
        {
            if (request.WeightGrams is <= 0 or > 1_000_000) throw new AccountingException("INVALID_PRODUCT_WEIGHT", 400);
            var product = await db.Products.SingleOrDefaultAsync(x => x.Id == request.ProductId, ct) ?? throw new AccountingException("PRODUCT_NOT_FOUND", 404);
            product.WeightGrams = request.WeightGrams; await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>Reads only allowlisted carrier reference catalogs.</summary>
    public sealed class ReferenceHandler(IPostexRates carrier) : IRequestHandler<Reference, JsonElement>
    {
        public async Task<JsonElement> Handle(Reference request, CancellationToken ct) => JsonSerializer.SerializeToElement(
            new { items = PostexReferences.Items(request.Resource, await carrier.ReferenceAsync(request.Resource, ct)) }, new JsonSerializerOptions(JsonSerializerDefaults.Web));
    }

    /// <summary>Obtains a carrier quote outside order transactions; the browser never supplies its monetary value.</summary>
    public sealed class QuoteHandler(AppDbContext db, CartQuotation pricing, IPostexRates carrier, TimeProvider time) : IRequestHandler<Quote, QuoteResult>
    {
        public async Task<QuoteResult> Handle(Quote request, CancellationToken ct)
        {
            if (request.Method is not ("post" or "tipax" or "freight")) throw new AccountingException("INVALID_SHIPPING_METHOD", 400);
            var address = await db.CustomerAddresses.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.AddressId && x.UserId == request.UserId, ct)
                ?? throw new AccountingException("ADDRESS_NOT_FOUND", 404);
            var quote = await pricing.QuoteAsync(request.Items, null, request.CouponCode, ct);
            ShippingPricing.ValidateMethod(request.Method, quote.Lines.Sum(x => x.Quantity));
            var policy = quote.Policy;
            if (policy.IncludedInPrice) return new(null, 0, "free", null, policy.Version, quote.Net + quote.Discount, quote.Discount, quote.Net);
            if (request.Method != "post") return new(null, 0, "collect", null, policy.Version, quote.Net + quote.Discount, quote.Discount, quote.Net);
            if (!carrier.Configured || string.IsNullOrWhiteSpace(policy.OriginCityCode) || string.IsNullOrWhiteSpace(policy.CourierCode) ||
                string.IsNullOrWhiteSpace(policy.ServiceType) || string.IsNullOrWhiteSpace(policy.PaymentType) || string.IsNullOrWhiteSpace(policy.CollectionType))
                throw new AccountingException("POSTEX_NOT_CONFIGURED", 503);
            if (policy.CourierCode != "IR_POST" || policy.PaymentType != "SENDER" || policy.CollectionType is not ("pick_up" or "postex_drop_off" or "courier_drop_off"))
                throw new AccountingException("POSTEX_NOT_CONFIGURED", 503);
            var methods = PostexReferences.Items("methods", await carrier.ReferenceAsync("methods", ct));
            if (!methods.Any(x => x.Code == policy.ServiceType)) throw new AccountingException("POSTEX_NOT_CONFIGURED", 503);
            var count = quote.Lines.Sum(x => x.Quantity);
            var package = (JsonSerializer.Deserialize<List<ShippingPackage>>(policy.PackagesJson) ?? []).SingleOrDefault(x => count >= x.MinQuantity && count <= x.MaxQuantity)
                ?? throw new AccountingException("PACKAGE_NOT_CONFIGURED", 422);
            if (quote.Lines.Any(x => x.Product.WeightGrams is null or <= 0)) throw new AccountingException("PRODUCT_WEIGHT_MISSING", 422);
            // City codes come only from the carrier catalog, with province included in unambiguous legacy name matching.
            var cities = await carrier.ReferenceAsync("cities", ct);
            if (!PostexReferences.Items("cities", cities).Any(x => x.Code == policy.OriginCityCode)) throw new AccountingException("POSTEX_NOT_CONFIGURED", 503);
            var city = PostexCityResolver.Resolve(cities, address.Province, address.City, request.DestinationCityCode);
            var fingerprint = Fingerprint(policy, address, quote, city);
            var now = time.GetUtcNow().UtcDateTime;
            var existing = await db.ShippingQuotes.AsNoTracking().Where(x => x.UserId == request.UserId && x.Fingerprint == fingerprint && x.ExpiresAtUtc > now).FirstOrDefaultAsync(ct);
            if (existing is not null) return new(existing.Id, existing.CostToman, "prepaid", DateTime.SpecifyKind(existing.ExpiresAtUtc, DateTimeKind.Utc), policy.Version, quote.Net + quote.Discount, quote.Discount, quote.Net + existing.CostToman);
            long measuredWeight = quote.Lines.Sum(x => (long)x.Product.WeightGrams!.Value * x.Quantity) + package.EmptyWeightGrams;
            if (measuredWeight > int.MaxValue) throw new AccountingException("PACKAGE_TOO_HEAVY", 422);
            int weight = (int)measuredWeight;
            var cost = await carrier.QuoteAsync(new(policy, package, city, weight, quote.Net), ct);
            if (cost <= 0) throw new AccountingException("POSTEX_INVALID_QUOTE", 503);
            var row = new ShippingQuote { UserId = request.UserId, AddressId = address.Id, Fingerprint = fingerprint, DestinationCityCode = city, PolicyVersion = policy.Version,
                CostToman = cost, ExpiresAtUtc = time.GetUtcNow().UtcDateTime.AddMinutes(10) };
            db.ShippingQuotes.Add(row); await db.SaveChangesAsync(ct);
            return new(row.Id, row.CostToman, "prepaid", row.ExpiresAtUtc, row.PolicyVersion, quote.Net + quote.Discount, quote.Discount, quote.Net + row.CostToman);
        }
    }

    /// <summary>Binds a price to exact items, measured weights, address contents, policy revision and destination code.</summary>
    public static string Fingerprint(ShippingPolicy policy, CustomerAddress address, CartQuote quote, string city) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new {
            policy.Version, address.Id, address.UserId, address.Province, address.City, address.StreetAddress, address.PostalCode,
            address.RecipientName, address.PhoneNumber, address.Plaque, address.Unit, address.Latitude, address.Longitude, DestinationCode = city,
            Lines = quote.Lines.OrderBy(x => x.Product.Id).Select(x => new { x.Product.Id, x.Quantity, x.UnitPrice, x.Discount, x.Product.WeightGrams }) }))));
}

/// <summary>Resolves destination identifiers only against the carrier-provided city/province hierarchy.</summary>
public static class PostexCityResolver
{
    /// <summary>Rejects missing/ambiguous matches; an explicit ID must belong to the address's province and city.</summary>
    public static string Resolve(JsonElement json, string province, string city, string? explicitCode)
    {
        var matches = new List<string>();
        Walk(json, "");
        var distinct = matches.Distinct().ToList();
        if (explicitCode is not null && distinct.Contains(explicitCode)) return explicitCode;
        if (explicitCode is null && distinct.Count == 1) return distinct[0];
        throw new AccountingException("POSTEX_CITY_SELECTION_REQUIRED", 422);

        void Walk(JsonElement node, string parentProvince)
        {
            if (node.ValueKind == JsonValueKind.Array) { foreach (var child in node.EnumerateArray()) Walk(child, parentProvince); return; }
            if (node.ValueKind != JsonValueKind.Object) return;
            string Text(params string[] keys) => keys.Select(k => node.TryGetProperty(k, out var v) && v.ValueKind is JsonValueKind.String or JsonValueKind.Number ? v.ToString() : "").FirstOrDefault(v => v.Length > 0) ?? "";
            var name = Text("name", "city_name", "cityName", "text");
            var region = Text("province_name", "provinceName", "state_name", "stateName");
            if (region.Length == 0) region = parentProvince;
            if (Normalize(name) == Normalize(city) && Normalize(region) == Normalize(province))
            { var id = Text("code", "city_code", "cityCode", "id", "value"); if (id.Length > 0) matches.Add(id); }
            foreach (var property in node.EnumerateObject())
                if (property.Value.ValueKind is JsonValueKind.Array or JsonValueKind.Object) Walk(property.Value, property.Name is "cities" or "children" ? name : region);
        }
    }

    /// <summary>Normalizes Persian letter variants and whitespace for address matching, never substring matching.</summary>
    private static string Normalize(string value) => string.Concat(value.Replace('ي', 'ی').Replace('ك', 'ک').Where(c => !char.IsWhiteSpace(c) && c != '\u200c'));
}
