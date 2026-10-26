namespace Domain.Entities;

/// <summary>Versioned store-wide retail shipping policy; product base prices remain independent.</summary>
public sealed class ShippingPolicy
{
    public int Id { get; set; } = 1;
    public bool IncludedInPrice { get; set; }
    public decimal UnitAmount { get; set; } = 250_000m;
    public long Version { get; set; } = 1;
    public string OriginCityCode { get; set; } = "";
    public double? OriginLatitude { get; set; }
    public double? OriginLongitude { get; set; }
    public string CourierCode { get; set; } = "IR_POST";
    public string ServiceType { get; set; } = "";
    public string PaymentType { get; set; } = "SENDER";
    public string CollectionType { get; set; } = "courier_drop_off";
    public string PackagesJson { get; set; } = "[]";
    public DateTime UpdatedAtUtc { get; set; }

    /// <summary>Calculates the retail unit price without modifying a product or calling a carrier.</summary>
    public decimal SellingPrice(decimal basePrice) => basePrice + (IncludedInPrice ? UnitAmount : 0);
}

/// <summary>An administrator-confirmed parcel profile for a non-overlapping inclusive quantity range.</summary>
public sealed record ShippingPackage(int MinQuantity, int MaxQuantity, int EmptyWeightGrams,
    int LengthCm, int WidthCm, int HeightCm, int BoxTypeId);

/// <summary>A short-lived, user-bound server quote; no credentials or carrier response bodies are persisted.</summary>
public sealed class ShippingQuote
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid AddressId { get; set; }
    public string Fingerprint { get; set; } = "";
    public string DestinationCityCode { get; set; } = "";
    public long PolicyVersion { get; set; }
    public decimal CostToman { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
}
