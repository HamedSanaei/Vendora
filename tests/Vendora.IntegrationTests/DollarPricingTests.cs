using System.Net;
using System.Text;
using System.Text.Json;
using Application.Interfaces;
using Application.Pricing;
using Domain.Entities;
using Domain.Enums;
using Domain.Pricing;
using Infrastructure.Pricing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Persistence;
using Persistence.Carts;
using Persistence.Orders;
using Persistence.Products;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Verifies monetary rounding, durable polling limits, provider normalization, and checkout snapshots.</summary>
public sealed class DollarPricingTests
{
    /// <summary>Rounds per-unit prices upward without adding an increment to exact multiples.</summary>
    [Theory]
    [InlineData(3, 103500, 320000)]
    [InlineData(3, 100000, 300000)]
    [InlineData(0.01, 103500, 10000)]
    [InlineData(3.25, 103500, 340000)]
    public void TomanPrice_RoundsUp(decimal usd, decimal rate, decimal expected)
        => Assert.Equal(expected, DollarPricing.ToToman(usd, rate));

    /// <summary>Prevents invalid or excessively precise prices from entering pricing calculations.</summary>
    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(0.00001)]
    [InlineData(1000001)]
    public void InvalidDollarPrices_AreRejected(decimal usd)
        => Assert.Throws<ArgumentOutOfRangeException>(() => DollarPricing.ToToman(usd, 100000));

    /// <summary>The actual migration chain introduces an empty rate without converting existing Toman prices.</summary>
    [Fact]
    public async Task Migration_IntroducesNoInventedExchangeRate()
    {
        await using var fixture = await PricingDb.CreateAsync(migrate: true);
        var rate = await fixture.Db.UsdtExchangeRates.SingleAsync();
        Assert.Null(rate.TomanPerUsdt);
        Assert.Null(rate.UpdatedAtUtc);
        Assert.Equal(DateTime.UnixEpoch, rate.NextRefreshAtUtc);
        Assert.False(fixture.Db.Database.HasPendingModelChanges());
    }

    /// <summary>A durable claim prevents another process or restart from polling before exactly 30 minutes.</summary>
    [Fact]
    public async Task Refresh_IsLimitedToOneAttemptPerThirtyMinutesAcrossScopes()
    {
        await using var fixture = await PricingDb.CreateAsync();
        var source = new FakeSource("Nobitex", 103500);
        var clock = new TestClock();
        await Handler(fixture.Db, clock, source).Handle(new(), default);
        await using var restarted = fixture.NewContext();
        await Handler(restarted, clock, source).Handle(new(), default);
        clock.Advance(TimeSpan.FromMinutes(29));
        await Handler(restarted, clock, source).Handle(new(), default);
        Assert.Equal(1, source.Calls);
        clock.Advance(TimeSpan.FromMinutes(1));
        await Handler(restarted, clock, source).Handle(new(), default);
        Assert.Equal(2, source.Calls);
        Assert.Equal(clock.GetUtcNow().UtcDateTime.AddMinutes(30),
            await restarted.UsdtExchangeRates.AsNoTracking().Select(rate => rate.NextRefreshAtUtc).SingleAsync());
    }

    /// <summary>One update publishes derived catalog/cart prices while preserving fixed prices and historical orders.</summary>
    [Fact]
    public async Task Refresh_RepricesDollarProductsAndCartsButNotExistingOrders()
    {
        await using var fixture = await PricingDb.CreateAsync();
        var dollar = Product("Dollar");
        dollar.SetPricing(0, 3m, 100000m);
        var fixedProduct = Product("Fixed");
        fixedProduct.Price = 159900;
        var cart = new Cart { UserId = Guid.NewGuid() };
        cart.Items.Add(new CartItem { ProductId = dollar.Id, ProductTitle = dollar.Title, UnitPrice = 300000, Quantity = 2 });
        var historical = new Order { UserId = cart.UserId, OrderNumber = "HISTORICAL" };
        historical.Items.Add(new OrderItem { ProductId = dollar.Id, ProductTitle = dollar.Title, UnitPrice = 300000,
            Quantity = 1, UsdUnitPrice = 3m, PriceExchangeRate = 100000m });
        fixture.Db.AddRange(dollar, fixedProduct, cart, historical);
        await fixture.Db.SaveChangesAsync();
        await Handler(fixture.Db, new TestClock(), new FakeSource("Nobitex", 103500),
            new FakeSource("Wallex", 103000), new FakeSource("AbanTether", 103700)).Handle(new(), default);

        await using var read = fixture.NewContext();
        Assert.Equal(320000m, (await read.Products.FindAsync(dollar.Id))!.Price);
        Assert.Equal(103500m, (await read.Products.FindAsync(dollar.Id))!.PriceExchangeRate);
        Assert.Equal(159900m, (await read.Products.FindAsync(fixedProduct.Id))!.Price);
        Assert.Equal(320000m, (await read.CartItems.SingleAsync()).UnitPrice);
        Assert.Equal(300000m, (await read.OrderItems.SingleAsync()).UnitPrice);
        Assert.Equal(100000m, (await read.OrderItems.SingleAsync()).PriceExchangeRate);
    }

    /// <summary>Failed providers retain the last valid internal price and do not cause rapid retry loops.</summary>
    [Fact]
    public async Task FailedRefresh_RetainsRateAndAdvancesSchedule()
    {
        await using var fixture = await PricingDb.CreateAsync();
        var clock = new TestClock();
        var source = new FakeSource("Nobitex", 103500);
        await Handler(fixture.Db, clock, source).Handle(new(), default);
        clock.Advance(TimeSpan.FromMinutes(30));
        source.Value = null;
        await using var second = fixture.NewContext();
        await Handler(second, clock, source).Handle(new(), default);
        var rate = await second.UsdtExchangeRates.AsNoTracking().SingleAsync();
        Assert.Equal(103500m, rate.TomanPerUsdt);
        Assert.Equal(clock.GetUtcNow().UtcDateTime.AddMinutes(-30), rate.UpdatedAtUtc);
        Assert.NotNull(rate.LastError);
        await Handler(second, clock, source).Handle(new(), default);
        Assert.Equal(2, source.Calls);
    }

    /// <summary>A provider failure cannot prevent a remaining valid quote from being used.</summary>
    [Fact]
    public async Task ProviderException_IsIsolatedAndReadQueriesNeverPoll()
    {
        await using var fixture = await PricingDb.CreateAsync();
        var bad = new FakeSource("Nobitex", null) { Fails = true };
        var good = new FakeSource("Wallex", 103500);
        await Handler(fixture.Db, new TestClock(), bad, good).Handle(new(), default);
        for (int i = 0; i < 3; i++)
            Assert.Equal(103500m, (await new ExchangeRateQueries.Handler(fixture.Db).Handle(new(), default)).TomanPerUsdt);
        Assert.Equal(1, bad.Calls);
        Assert.Equal(1, good.Calls);
        Assert.Equal(DateTimeKind.Utc, (await new ExchangeRateQueries.Handler(fixture.Db).Handle(new(), default)).UpdatedAtUtc!.Value.Kind);
    }

    /// <summary>Rejects Rial/Toman scale mistakes and protects a healthy majority from an outlier.</summary>
    [Fact]
    public void DisagreeingQuotes_DoNotPublishAnInvalidRate()
    {
        Assert.Empty(RefreshExchangeRate.Handler.SelectConsistentQuotes([
            new("Nobitex", 1000000), new("Wallex", 100000)]));
        var accepted = RefreshExchangeRate.Handler.SelectConsistentQuotes([
            new("Nobitex", 100000), new("Wallex", 101000), new("AbanTether", 1000000)]);
        Assert.Equal(2, accepted.Count);
        Assert.DoesNotContain(accepted, quote => quote.Source == "AbanTether");
    }

    /// <summary>Real adapter field extraction explicitly normalizes Nobitex Rials and Wallex Toman.</summary>
    [Theory]
    [InlineData("Nobitex", "{\"status\":\"ok\",\"stats\":{\"usdt-rls\":{\"isClosed\":false,\"latest\":\"1035000\"}}}")]
    [InlineData("Wallex", "{\"success\":true,\"result\":{\"symbols\":{\"USDTTMN\":{\"stats\":{\"lastPrice\":\"103500\"}}}}}")]
    [InlineData("AbanTether", "{\"data\":{\"markets\":{\"USDTIRT\":{\"symbol\":\"USDT\",\"buy_price\":\"104000\",\"sell_price\":\"103000\",\"active\":true}}}}")]
    public async Task Providers_NormalizeUnits(string name, string json)
    {
        var transport = new FakeHttpFactory(json);
        var source = new PublicUsdtRateSource(name, transport);
        Assert.Equal(103500m, (await source.ReadAsync(default))!.TomanPerUsdt);
        Assert.Equal(1, transport.Calls);
    }

    /// <summary>Inactive OTC markets cannot supply pricing rates.</summary>
    [Fact]
    public async Task InactiveAbanMarket_IsRejected()
    {
        var transport = new FakeHttpFactory("{\"data\":{\"markets\":{\"USDTIRT\":{\"active\":false,\"buy_price\":\"104000\",\"sell_price\":\"103000\"}}}}");
        Assert.Null(await new PublicUsdtRateSource("AbanTether", transport).ReadAsync(default));
        Assert.Equal(1, transport.Calls);
    }

    /// <summary>New dollar products require a real internal rate and ignore client-supplied Toman guesses.</summary>
    [Fact]
    public async Task ProductWrites_RequireRateAndPreserveFixedTomanMode()
    {
        await using var fixture = await PricingDb.CreateAsync();
        var product = Product("Price");
        Assert.NotNull(await ProductPriceWriter.ApplyAsync(fixture.Db, product, 1, 3, default));
        await Handler(fixture.Db, new TestClock(), new FakeSource("Wallex", 103500)).Handle(new(), default);
        Assert.Null(await ProductPriceWriter.ApplyAsync(fixture.Db, product, 1, 3, default));
        Assert.Equal(320000m, product.Price);
        Assert.Null(await ProductPriceWriter.ApplyAsync(fixture.Db, product, 123456, null, default));
        Assert.Equal(123456m, product.Price);
        Assert.Null(product.UsdPrice);
        Assert.Null(product.PriceExchangeRate);
    }

    /// <summary>A stale customer price cannot create an order; a confirmed current price is snapshotted once.</summary>
    [Fact]
    public async Task Checkout_RequiresCurrentPriceAndSnapshotsDollarBasis()
    {
        await using var fixture = await PricingDb.CreateAsync();
        var product = Product("Order");
        product.SetPricing(0, 3, 103500);
        var address = new CustomerAddress { UserId = Guid.NewGuid(), Title = "Home", RecipientName = "Customer",
            PhoneNumber = "09121111111", Province = "Tehran", City = "Tehran", StreetAddress = "Street", PostalCode = "1234567890" };
        fixture.Db.AddRange(product, address);
        await fixture.Db.SaveChangesAsync();
        var handler = new Application.Orders.Create.Handler(new CartRepository(fixture.Db), new OrderRepository(fixture.Db),
            new ProductReadRepository(fixture.Db), fixture.Db, fixture.Db);
        var command = new Application.Orders.Create.Command(address.UserId, 60000, 0, address.Id, null,
            [new(product.Id, 2, 300000)]);
        await Assert.ThrowsAsync<PriceChangedException>(() => handler.Handle(command, default));
        Assert.Equal(0, await fixture.Db.Orders.CountAsync());
        fixture.Db.ChangeTracker.Clear();
        var result = await handler.Handle(command with { Items = [new(product.Id, 2, 320000)] }, default);
        var line = await fixture.Db.OrderItems.AsNoTracking().SingleAsync();
        Assert.Equal(320000m, line.UnitPrice);
        Assert.Equal(3m, line.UsdUnitPrice);
        Assert.Equal(103500m, line.PriceExchangeRate);
        Assert.Equal(700000m, result.TotalAmount);
        Assert.Equal(18, (await fixture.Db.Products.FindAsync(product.Id))!.StockQuantity);
    }

    /// <summary>Creates a valid catalog product without network or identity dependencies.</summary>
    private static Product Product(string title) => new() { Title = title, Slug = title.ToLowerInvariant(), Price = 100000,
        Status = ProductStatus.Active, StockQuantity = 20 };

    /// <summary>Constructs the use case with controlled time and public quote sources.</summary>
    private static RefreshExchangeRate.Handler Handler(AppDbContext db, TestClock clock, params IUsdtRateSource[] sources)
        => new(db, sources, NullLogger<RefreshExchangeRate.Handler>.Instance, clock);

    private sealed class TestClock : TimeProvider
    {
        private DateTimeOffset _now = new(2026, 10, 20, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => _now;
        /// <summary>Moves the deterministic clock without blocking or waiting for real time.</summary>
        public void Advance(TimeSpan interval) => _now += interval;
    }

    private sealed class FakeSource(string name, decimal? value) : IUsdtRateSource
    {
        public string Name => name;
        public decimal? Value { get; set; } = value;
        public bool Fails { get; set; }
        public int Calls { get; private set; }
        /// <inheritdoc />
        public Task<UsdtRateQuote?> ReadAsync(CancellationToken cancellationToken)
        {
            Calls++;
            if (Fails) throw new HttpRequestException("Simulated unavailable provider.");
            return Task.FromResult(Value.HasValue ? new UsdtRateQuote(Name, Value.Value) : null);
        }
    }

    private sealed class FakeHttpFactory(string json) : HttpMessageHandler, IHttpClientFactory
    {
        public int Calls { get; private set; }
        /// <inheritdoc />
        public HttpClient CreateClient(string name) => new(this, disposeHandler: false);
        /// <inheritdoc />
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                { Content = new StringContent(json, Encoding.UTF8, "application/json") });
        }
    }

    private sealed class PricingDb(SqliteConnection connection, AppDbContext db) : IAsyncDisposable
    {
        public AppDbContext Db => db;
        /// <summary>Creates an isolated real SQLite database with the current schema or complete migration chain.</summary>
        public static async Task<PricingDb> CreateAsync(bool migrate = false)
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
            if (migrate) await db.Database.MigrateAsync(); else await db.Database.EnsureCreatedAsync();
            return new PricingDb(connection, db);
        }
        /// <summary>Opens another scope over the same database to emulate restarts and independent readers.</summary>
        public AppDbContext NewContext() => new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        /// <inheritdoc />
        public async ValueTask DisposeAsync() { await db.DisposeAsync(); await connection.DisposeAsync(); }
    }
}
