using Domain.Entities;
using Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Persistence;

/// <summary>
/// Seeds safe development data when the database is empty.
/// </summary>
public static class SeedData
{
    /// <summary>
    /// Inserts sample data only when the main catalog is empty.
    /// </summary>
    /// <param name="dbContext">The application database context.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    public static async Task SeedAsync(AppDbContext dbContext, CancellationToken cancellationToken = default)
    {
        if (await dbContext.Products.AsNoTracking().AnyAsync(cancellationToken))
        {
            return;
        }

        var handbags = new Category
        {
            Name = "Handbags",
            Slug = "handbags",
            IsActive = true
        };

        var backpacks = new Category
        {
            Name = "Backpacks",
            Slug = "backpacks",
            IsActive = true
        };

        var travelBags = new Category
        {
            Name = "Travel Bags",
            Slug = "travel-bags",
            IsActive = true
        };

        var leatherHandbag = new Product
        {
            Title = "Leather Handbag",
            Slug = "leather-handbag",
            Description = "A compact leather handbag for everyday use.",
            Price = 1250000m,
            StockQuantity = 18,
            Status = ProductStatus.Active,
            InventoryStatus = InventoryStatus.InStock,
            Category = handbags,
            Images =
            [
                new ProductImage
                {
                    ImageUrl = "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80",
                    AltText = "Leather handbag",
                    IsPrimary = true,
                    SortOrder = 1
                }
            ]
        };

        var cityBackpack = new Product
        {
            Title = "City Backpack",
            Slug = "city-backpack",
            Description = "A lightweight backpack designed for daily commuting.",
            Price = 980000m,
            StockQuantity = 11,
            Status = ProductStatus.Active,
            InventoryStatus = InventoryStatus.InStock,
            Category = backpacks,
            Images =
            [
                new ProductImage
                {
                    ImageUrl = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
                    AltText = "City backpack",
                    IsPrimary = true,
                    SortOrder = 1
                }
            ]
        };

        var weekenderBag = new Product
        {
            Title = "Weekender Duffel",
            Slug = "weekender-duffel",
            Description = "A spacious duffel bag for short trips and weekend travel.",
            Price = 1560000m,
            StockQuantity = 7,
            Status = ProductStatus.Active,
            InventoryStatus = InventoryStatus.LowStock,
            Category = travelBags,
            Images =
            [
                new ProductImage
                {
                    ImageUrl = "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80",
                    AltText = "Weekender duffel bag",
                    IsPrimary = true,
                    SortOrder = 1
                }
            ]
        };

        var adminUser = new UserAccount
        {
            FullName = "Vendora Admin",
            Email = "admin@vendora.local",
            PhoneNumber = "09120000000",
            Role = UserRole.Admin
        };

        var customerUser = new UserAccount
        {
            FullName = "Test Customer",
            Email = "customer@vendora.local",
            PhoneNumber = "09121111111",
            Role = UserRole.Customer
        };

        var cart = new Cart
        {
            UserId = customerUser.Id,
            Items =
            [
                new CartItem
                {
                    ProductId = cityBackpack.Id,
                    ProductTitle = cityBackpack.Title,
                    UnitPrice = cityBackpack.Price,
                    Quantity = 1
                }
            ]
        };

        var order = new Order
        {
            UserId = customerUser.Id,
            OrderNumber = "ORD-SEED-0001",
            Status = OrderStatus.Paid,
            PaymentStatus = PaymentStatus.Verified,
            CurrencyCode = "IRR",
            ShippingCost = 150000m,
            DiscountAmount = 50000m,
            Items =
            [
                new OrderItem
                {
                    ProductId = leatherHandbag.Id,
                    ProductTitle = leatherHandbag.Title,
                    UnitPrice = leatherHandbag.Price,
                    Quantity = 1
                }
            ]
        };

        order.RecalculateTotals();

        var paymentTransaction = new PaymentTransaction
        {
            Order = order,
            Provider = PaymentProvider.Zarinpal,
            Authority = "TEST-AUTHORITY-0001",
            ReferenceId = "TEST-REF-0001",
            Amount = order.TotalAmount,
            Status = PaymentStatus.Verified
        };

        await dbContext.Categories.AddRangeAsync([handbags, backpacks, travelBags], cancellationToken);
        await dbContext.Products.AddRangeAsync([leatherHandbag, cityBackpack, weekenderBag], cancellationToken);
        await dbContext.UserAccounts.AddRangeAsync([adminUser, customerUser], cancellationToken);
        await dbContext.Carts.AddAsync(cart, cancellationToken);
        await dbContext.Orders.AddAsync(order, cancellationToken);
        await dbContext.PaymentTransactions.AddAsync(paymentTransaction, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
    }
}
