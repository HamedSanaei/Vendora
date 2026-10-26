using Application.Orders.DTOs;
using Domain.Entities;

namespace Application.Orders;

internal static class OrderMappings
{
    public static OrderDto Map(Order order)
    {
        return new OrderDto(
            order.Id,
            order.OrderNumber,
            order.CreatedAtUtc,
            order.Status.ToString(),
            order.PaymentStatus.ToString(),
            order.Subtotal,
            order.ShippingCost,
            order.DiscountAmount,
            order.TotalAmount,
            new OrderShippingAddressDto(
                order.ShippingAddressId,
                order.ShippingRecipientName,
                order.ShippingPhoneNumber,
                order.ShippingProvince,
                order.ShippingCity,
                order.ShippingStreetAddress,
                order.ShippingPlaque,
                order.ShippingUnit,
                order.ShippingPostalCode,
                order.ShippingLatitude,
                order.ShippingLongitude),
            order.Items
                .OrderBy(item => item.ProductTitle)
                .Select(item => new OrderItemDto(
                    item.ProductId,
                    item.ProductTitle,
                    item.UnitPrice,
                    item.Quantity,
                    item.LineTotal))
                .ToList(), order.ShippingMethodId, ShippingPaymentMode(order));
    }
    /// <summary>Displays original delivery terms, never the current store policy, for an existing order.</summary>
    private static string? ShippingPaymentMode(Order order)
    {
        if (order.ShippingPolicySnapshotJson is null) return null;
        using var data = System.Text.Json.JsonDocument.Parse(order.ShippingPolicySnapshotJson);
        if (data.RootElement.TryGetProperty("IncludedInPrice", out var included) && included.ValueKind == System.Text.Json.JsonValueKind.True) return "free";
        return order.ShippingMethodId == "post" ? "prepaid" : "collect";
    }
}
