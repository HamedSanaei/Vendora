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
            order.Status.ToString(),
            order.PaymentStatus.ToString(),
            order.Subtotal,
            order.ShippingCost,
            order.DiscountAmount,
            order.TotalAmount,
            order.Items
                .OrderBy(item => item.ProductTitle)
                .Select(item => new OrderItemDto(
                    item.ProductId,
                    item.ProductTitle,
                    item.UnitPrice,
                    item.Quantity,
                    item.LineTotal))
                .ToList());
    }
}
