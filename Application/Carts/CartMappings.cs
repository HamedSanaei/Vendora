using Application.Carts.DTOs;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Carts;

internal static class CartMappings
{
    public static async Task<CartDto> MapAsync(Cart cart, AppDbContext db, CancellationToken ct)
    {
        var policy = await Application.Shipping.ShippingPricing.ReadAsync(db, ct);
        var ids = cart.Items.Select(x => x.ProductId).ToList();
        var prices = await db.Products.AsNoTracking().Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.Price, ct);
        decimal Price(CartItem item) => policy.SellingPrice(prices.GetValueOrDefault(item.ProductId, item.UnitPrice));
        var items = cart.Items
            .OrderBy(item => item.ProductTitle)
            .Select(item => new CartItemDto(
                item.ProductId,
                item.ProductTitle,
                Price(item),
                item.Quantity,
                Price(item) * item.Quantity))
            .ToList();

        return new CartDto(
            cart.Id,
            cart.UserId,
            items,
            items.Sum(item => item.LineTotal));
    }
}
