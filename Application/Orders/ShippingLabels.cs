using Application.Interfaces;
using Application.StoreSettings;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;
using System.Text.Json;

namespace Application.Orders;

/// <summary>Builds administrator-only logistics PDFs from order address snapshots and current sender settings.</summary>
public static class ShippingLabels
{
    public sealed record Query(IReadOnlyList<Guid> OrderIds) : IRequest<Result>;
    public sealed record Result(byte[] Bytes, string FileName);

    /// <summary>Provides a safe field/order-specific error without returning customer addresses in an error response.</summary>
    public sealed class LabelException(string code, int status, string? orderNumber = null, IReadOnlyList<string>? fields = null) : Exception(code)
    {
        public string Code { get; } = code;
        public int Status { get; } = status;
        public string? OrderNumber { get; } = orderNumber;
        public IReadOnlyList<string> Fields { get; } = fields ?? [];
    }

    /// <summary>Reads data without changing order/payment/stock, validates every label before the renderer is invoked.</summary>
    public sealed class Handler(AppDbContext db, IShippingLabelRenderer renderer) : IRequestHandler<Query, Result>
    {
        public async Task<Result> Handle(Query request, CancellationToken ct)
        {
            if (request.OrderIds is null || request.OrderIds.Count == 0 || request.OrderIds.Count > 1000)
                throw new LabelException("LABEL_INVALID_SELECTION", 400);
            var ids = request.OrderIds.Distinct().ToArray();
            if (ids.Length > 100 || ids.Contains(Guid.Empty)) throw new LabelException("LABEL_INVALID_SELECTION", 400);
            var orders = await db.Orders.AsNoTracking().Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
            if (orders.Count != ids.Length) throw new LabelException("LABEL_ORDER_NOT_FOUND", 404);
            var settings = await db.SeoSettings.AsNoTracking().SingleOrDefaultAsync(ct);
            var sender = settings is null ? new StoreProfile() : StoreSettingsUseCases.Read(settings);
            string name = sender.NameFa?.Trim() ?? settings?.SiteName?.Trim() ?? "";
            var missingSender = new List<string>();
            if (string.IsNullOrWhiteSpace(name)) missingSender.Add("senderName");
            if (string.IsNullOrWhiteSpace(sender.AddressFa)) missingSender.Add("senderAddress");
            if (string.IsNullOrWhiteSpace(sender.Phone)) missingSender.Add("supportPhone");
            if (missingSender.Count > 0) throw new LabelException("LABEL_SENDER_INCOMPLETE", 422, fields: missingSender);
            var labels = new List<ShippingLabelData>();
            foreach (Guid id in ids)
            {
                var order = orders[id]; var missing = new List<string>();
                foreach (var (field, value) in new[] { ("recipientName", order.ShippingRecipientName), ("recipientPhone", order.ShippingPhoneNumber),
                    ("province", order.ShippingProvince), ("city", order.ShippingCity), ("streetAddress", order.ShippingStreetAddress), ("postalCode", order.ShippingPostalCode), ("orderNumber", order.OrderNumber) })
                    if (string.IsNullOrWhiteSpace(value)) missing.Add(field);
                if (missing.Count > 0) throw new LabelException("LABEL_RECIPIENT_INCOMPLETE", 422, order.OrderNumber, missing);
                labels.Add(new(id, order.OrderNumber, order.ShippingRecipientName, order.ShippingPhoneNumber, order.ShippingProvince,
                    order.ShippingCity, order.ShippingStreetAddress, order.ShippingPlaque, order.ShippingUnit, order.ShippingPostalCode,
                    name, sender.AddressFa!, sender.Phone!, Method(order.ShippingMethodId), Terms(order.ShippingMethodId, order.ShippingPolicySnapshotJson)));
            }
            var bytes = await renderer.RenderAsync(labels, ct);
            return new(bytes, ids.Length == 1 ? $"shipping-label-{ids[0]:N}-A5.pdf" : "shipping-labels-A5.pdf");
        }
    }

    /// <summary>Uses recorded carrier identity, without replacing unknown historical data with the current default.</summary>
    private static string Method(string? id) => id switch { "post" => "پست پیشتاز", "tipax" => "تیپاکس", "freight" => "باربری", _ => "ثبت نشده" };

    /// <summary>Reads only recorded policy terms; missing/malformed historical evidence never implies free or prepaid delivery.</summary>
    private static string Terms(string? method, string? snapshot)
    {
        if (string.IsNullOrWhiteSpace(snapshot)) return "ثبت نشده";
        try
        {
            using var json = JsonDocument.Parse(snapshot);
            if (json.RootElement.ValueKind != JsonValueKind.Object || !json.RootElement.TryGetProperty("IncludedInPrice", out var included) || included.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return "ثبت نشده";
            if (included.GetBoolean()) return "رایگان";
            return method switch { "post" => "پیش‌پرداخت", "tipax" or "freight" => "پرداخت هنگام تحویل", _ => "ثبت نشده" };
        }
        catch (JsonException) { return "ثبت نشده"; }
    }
}
