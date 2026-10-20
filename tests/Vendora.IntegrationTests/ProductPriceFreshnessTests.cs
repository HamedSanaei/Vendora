using Application.Catalog;
using Application.Pricing;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Content;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Persistence;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Ensures a current-date price label never certifies stale, failed, unavailable, or mismatched prices.</summary>
public sealed class ProductPriceFreshnessTests
{
    private static readonly DateTime Now = new(2026, 10, 20, 12, 0, 0, DateTimeKind.Utc);

    /// <summary>Valid dollar prices are confirmed at server read time, even when an unchanged rate was refreshed earlier.</summary>
    [Fact]
    public void StockedDollarProduct_WithCorrectFreshRate_IsConfirmed()
    {
        var result = ProductPriceFreshness.Verify(Product("Dollar"), Rate(), Now);
        Assert.NotNull(result);
        Assert.Equal(Now, result.VerifiedAtUtc);
        Assert.Equal(Now.AddMinutes(25), result.ExpiresAtUtc);
        Assert.Equal(DateTimeKind.Utc, result.ExpiresAtUtc.Kind);
    }

    /// <summary>Missing, stale, failed, future-dated, or inconsistent pricing must not get today's label.</summary>
    [Theory]
    [InlineData("fixed")]
    [InlineData("out-of-stock")]
    [InlineData("negative-stock")]
    [InlineData("no-rate")]
    [InlineData("no-value")]
    [InlineData("invalid-value")]
    [InlineData("no-success")]
    [InlineData("stale")]
    [InlineData("expired-exactly")]
    [InlineData("future")]
    [InlineData("failed")]
    [InlineData("no-source")]
    [InlineData("mismatched-rate")]
    [InlineData("mismatched-price")]
    [InlineData("invalid-dollar-price")]
    public void InvalidPricing_HasNoCurrentDateLabel(string scenario)
    {
        var product = Product("Dollar");
        UsdtExchangeRate? rate = Rate();
        switch (scenario)
        {
            case "fixed": product.UsdPrice = null; break;
            case "out-of-stock": product.StockQuantity = 0; break;
            case "negative-stock": product.StockQuantity = -1; break;
            case "no-rate": rate = null; break;
            case "no-value": rate.TomanPerUsdt = null; break;
            case "invalid-value": rate.TomanPerUsdt = 0; break;
            case "no-success": rate.UpdatedAtUtc = null; break;
            case "stale": rate.UpdatedAtUtc = Now.AddMinutes(-31); break;
            case "expired-exactly": rate.UpdatedAtUtc = Now.AddMinutes(-30); break;
            case "future": rate.UpdatedAtUtc = Now.AddSeconds(1); break;
            case "failed": rate.LastError = "Refresh failed; previous rate retained."; break;
            case "no-source": rate.Sources = ""; break;
            case "mismatched-rate": product.PriceExchangeRate = 100000; break;
            case "mismatched-price": product.Price = 300000; break;
            case "invalid-dollar-price": product.UsdPrice = -3; break;
        }
        Assert.Null(ProductPriceFreshness.Verify(product, rate, Now));
    }

    /// <summary>Cached today's labels expire at Tehran midnight rather than leaking yesterday's date into a new day.</summary>
    [Fact]
    public void Confirmation_ExpiresAtIranianMidnight()
    {
        var now = new DateTime(2026, 10, 20, 20, 25, 0, DateTimeKind.Utc); // 23:55 Tehran.
        var rate = Rate();
        rate.UpdatedAtUtc = now.AddMinutes(-1);
        var result = ProductPriceFreshness.Verify(Product("Dollar"), rate, now)!;
        Assert.Equal(new DateTime(2026, 10, 20, 20, 30, 0, DateTimeKind.Utc), result.ExpiresAtUtc);
        // A still-valid rate from before midnight can certify the same price on the new local day.
        var tomorrow = ProductPriceFreshness.Verify(Product("Dollar"), rate, now.AddMinutes(6))!;
        Assert.Equal(now.AddMinutes(6), tomorrow.VerifiedAtUtc);
    }

    /// <summary>Both catalog and detail return only eligible metadata; reading does not invoke any exchange adapter.</summary>
    [Fact]
    public async Task CatalogAndDetails_UseOnlyTheInternalPersistedRate()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var rate = await db.UsdtExchangeRates.SingleAsync();
        rate.TomanPerUsdt = 103500; rate.UpdatedAtUtc = Now.AddMinutes(-5); rate.Sources = "Nobitex, Wallex";
        var valid = Product("valid");
        var unavailable = Product("unavailable"); unavailable.StockQuantity = 0;
        var fixedPrice = Product("fixed"); fixedPrice.UsdPrice = null;
        db.Products.AddRange(valid, unavailable, fixedPrice);
        await db.SaveChangesAsync();

        var clock = new PricingClock();
        var handler = new CatalogQueries.Products.Handler(db, new ProductDescriptionService(), clock);
        var products = await handler.Handle(new(), default);
        Assert.NotNull(products.Single(product => product.Id == valid.Id).PriceFreshness);
        Assert.Null(products.Single(product => product.Id == unavailable.Id).PriceFreshness);
        Assert.Null(products.Single(product => product.Id == fixedPrice.Id).PriceFreshness);
        var detail = Assert.Single(await handler.Handle(new(valid.Id.ToString()), default));
        Assert.Equal(products.Single(product => product.Id == valid.Id).PriceFreshness, detail.PriceFreshness);
        clock.Now = Now.AddMinutes(26);
        Assert.All(await handler.Handle(new(), default), product => Assert.Null(product.PriceFreshness));
        Assert.Equal(Now.AddMinutes(-5), (await db.UsdtExchangeRates.SingleAsync()).UpdatedAtUtc);
    }

    /// <summary>Creates a correctly materialized 3-dollar product for boundary tests.</summary>
    private static Product Product(string title)
    {
        var product = new Product { Title = title, Slug = title, StockQuantity = 10, Status = ProductStatus.Active };
        product.SetPricing(0, 3, 103500);
        return product;
    }

    /// <summary>Creates a successful five-minute-old stored rate.</summary>
    private static UsdtExchangeRate Rate() => new() { TomanPerUsdt = 103500, UpdatedAtUtc = Now.AddMinutes(-5), Sources = "Nobitex, Wallex" };

    private sealed class PricingClock : TimeProvider
    {
        public DateTime Now { get; set; } = ProductPriceFreshnessTests.Now;
        /// <inheritdoc />
        public override DateTimeOffset GetUtcNow() => new(Now);
    }
}
