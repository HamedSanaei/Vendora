using Application.Carts.DTOs;
using Domain.Entities;

namespace Application.Carts;

internal static class CartMappings
{
    public static CartDto Map(Cart cart)
    {
        var items = cart.Items
            .OrderBy(item => item.ProductTitle)
            .Select(item => new CartItemDto(
                item.ProductId,
                item.ProductTitle,
                item.UnitPrice,
                item.Quantity,
                item.UnitPrice * item.Quantity))
            .ToList();

        return new CartDto(
            cart.Id,
            cart.UserId,
            items,
            items.Sum(item => item.LineTotal));
    }
}
