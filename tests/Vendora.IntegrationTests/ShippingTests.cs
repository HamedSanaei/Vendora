using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Application.Accounting;
using Application.Interfaces;
using Application.Pricing;
using Application.Shipping;
using Domain.Accounting;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Shipping;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
using Persistence.Identity;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Exercises genuine database pricing, immutable snapshots and isolated provider responses; never uses production data.</summary>
public sealed class ShippingTests
{
    [Fact]
    public async Task PolicyHttp_ProtectsAdministration_AndPublicCatalogUsesSellingPrice()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync(services => {
            services.AddScoped<CartQuotation>(); services.AddSingleton<IPostexRates>(new FakeCarrier());
        });
        using var guest = host.Client(null); using var customer = host.Client("Customer"); using var admin = host.Client("Admin");
        var policy = await guest.GetFromJsonAsync<ShippingUseCases.PublicState>("/api/shipping/policy");
        Assert.NotNull(policy); Assert.False(policy.IncludedInPrice); Assert.Equal(250000, policy.UnitAmount);
        var edit = new ShippingUseCases.Save(new ShippingPolicy { IncludedInPrice = true, Version = 1 }, []);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PutAsJsonAsync("/api/admin/store-settings/shipping", edit)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PutAsJsonAsync("/api/admin/store-settings/shipping", edit)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync("/api/admin/store-settings/shipping", edit)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync("/api/admin/store-settings/shipping", edit)).StatusCode);
        Guid productId;
        using (var scope = host.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var product = new Product { Title = "Public bag", Slug = "public-bag", Price = 1000000, StockQuantity = 20, Status = ProductStatus.Active, CategoryId = host.CategoryId };
            db.Products.Add(product); await db.SaveChangesAsync(); productId = product.Id;
        }
        var catalog = await guest.GetFromJsonAsync<JsonElement>($"/api/catalog/products/{productId}");
        Assert.Equal(1250000, catalog.GetProperty("price").GetDecimal()); Assert.Equal(1000000, catalog.GetProperty("basePrice").GetDecimal());
        Assert.True(catalog.GetProperty("freeShipping").GetBoolean());
        var quote = new ShippingUseCases.Quote(Guid.NewGuid(), Guid.NewGuid(), [new(productId, 1, 1250000)], "post");
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PostAsJsonAsync("/api/shipping/quote", quote)).StatusCode);
        customer.DefaultRequestHeaders.Add("Test-User", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.NotFound, (await customer.PostAsJsonAsync("/api/shipping/quote", quote)).StatusCode);
    }

    [Fact]
    public async Task IncludedPrice_DiscountsOnlyBase_AndNeverMutatesProduct()
    {
        await using var f = await Fixture.Create();
        f.Policy.IncludedInPrice = true;
        f.Db.Coupons.Add(new Coupon { Code = "TEN", Title = "Ten", IsActive = true, AppliesToAllCategories = true, DiscountPercent = 10, ExpiresAtUtc = DateTime.UtcNow.AddDays(1) });
        await f.Db.SaveChangesAsync();
        var quote = await f.Pricing.QuoteAsync([new(f.Product.Id, 2, 1250000)], "tipax", "TEN", default);
        Assert.Equal(2_300_000m, quote.Net); Assert.Equal(200_000m, quote.Discount); Assert.Equal(0, quote.Freight);
        Assert.Equal(250_000m, quote.Lines[0].EmbeddedShippingUnitAmount);
        var preview = await new ShippingUseCases.CartPricingHandler(f.Pricing).Handle(new([new(f.Product.Id, 2, 1250000)], "TEN"), default);
        Assert.Equal(quote.Net, preview.Payable); Assert.Equal(quote.Discount, preview.Discount);
        Assert.Equal(1_000_000m, (await f.Db.Products.SingleAsync()).Price);
        Assert.Equal(EntityState.Unchanged, f.Db.Entry(f.Product).State);
        f.Policy.IncludedInPrice = false; await f.Db.SaveChangesAsync();
        Assert.Equal(1_000_000m, (await f.Pricing.QuoteAsync([new(f.Product.Id, 1, 1000000)], "tipax", null, default)).Net);
        f.Policy.IncludedInPrice = true; await f.Db.SaveChangesAsync();
        Assert.Equal(1_250_000m, (await f.Pricing.QuoteAsync([new(f.Product.Id, 1, 1250000)], "tipax", null, default)).Net);
    }

    [Fact]
    public async Task IssuedOrderAndProforma_PreservePriceAndTermsAfterPolicyChanges()
    {
        await using var f = await Fixture.Create(); f.Policy.IncludedInPrice = true; f.Policy.Version = 2;
        f.Db.Coupons.Add(new Coupon { Code = "TEN", Title = "Ten", IsActive = true, AppliesToAllCategories = true, DiscountPercent = 10, ExpiresAtUtc = DateTime.UtcNow.AddDays(1) });
        await f.Db.SaveChangesAsync();
        var issue = new ProformaCommands.IssueHandler(f.Db, new(f.Db, TimeProvider.System), f.Pricing, TimeProvider.System);
        var proformaId = await issue.Handle(new(f.User, "shipping-proforma", [new(f.Product.Id, 2, 1250000)], "post", "TEN", AddressId: f.Address.Id), default);
        var orderHandler = new Application.Orders.Create.Handler(new Persistence.Carts.CartRepository(f.Db), new Persistence.Orders.OrderRepository(f.Db),
            new Persistence.Products.ProductReadRepository(f.Db), f.Db, f.Db);
        var command = new Application.Orders.Create.Command(f.User, 999999, 1, f.Address.Id, null,
            [new(f.Product.Id, 2, 1250000)], "post", "TEN", "shipping-order");
        var result = await orderHandler.Handle(command, default);
        Assert.Equal(2300000, result.TotalAmount); Assert.Equal(0, result.ShippingCost); Assert.Equal(200000, result.DiscountAmount);
        Assert.Equal("free", result.ShippingPaymentMode);
        Assert.Equal(result.OrderNumber, (await orderHandler.Handle(command, default)).OrderNumber);
        f.Policy.IncludedInPrice = false; f.Policy.UnitAmount = 999999; f.Policy.Version++; await f.Db.SaveChangesAsync(); f.Db.ChangeTracker.Clear();
        var order = await f.Db.Orders.Include(x => x.Items).SingleAsync();
        Assert.Equal(2300000, order.TotalAmount); Assert.Equal(1000000, order.Items.Single().BaseUnitPrice); Assert.Equal(250000, order.Items.Single().EmbeddedShippingUnitAmount);
        var document = await f.Db.FinancialDocuments.Include(x => x.Lines).SingleAsync(x => x.Id == proformaId);
        Assert.Equal(2300000, document.TotalToman); Assert.Equal(0, document.Freight); Assert.False(document.ShippingUndetermined);
        Assert.Equal(2, JsonSerializer.Deserialize<PartySnapshot>(document.BuyerSnapshotJson)!.ShippingPolicyVersion);
        Assert.Contains("رایگان", JsonSerializer.Deserialize<PartySnapshot>(document.BuyerSnapshotJson)!.ShippingTerms);
        Assert.Equal(250000, document.Lines.Single().EmbeddedShippingUnitAmount);
        Assert.Equal(1000000, (await f.Db.Products.SingleAsync()).Price);
        Assert.Equal(2300000, AccountingMappings.Customer(document).TotalToman);
    }

    [Fact]
    public async Task DollarBaseIsRoundedFirst_StaleFixedPriceIsRejected()
    {
        await using var f = await Fixture.Create(); f.Policy.IncludedInPrice = true;
        await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<PriceChangedException>(() => f.Pricing.QuoteAsync([new(f.Product.Id, 1, 1000000)], null, null, default));
        f.Product.SetPricing(0, 3, 103500); await f.Db.SaveChangesAsync();
        var quote = await f.Pricing.QuoteAsync([new(f.Product.Id, 1, 570000)], null, null, default);
        Assert.Equal(320000, f.Product.Price); Assert.Equal(570000, quote.Net);
    }

    [Theory]
    [InlineData(10, false)]
    [InlineData(11, true)]
    public async Task FreightEligibilityUsesTotalUnitCount(int quantity, bool allowed)
    {
        await using var f = await Fixture.Create();
        var task = f.Pricing.QuoteAsync([new(f.Product.Id, quantity)], "freight", null, default);
        if (allowed) Assert.Equal(0, (await task).Freight);
        else Assert.Equal("FREIGHT_MIN_QUANTITY", (await Assert.ThrowsAsync<AccountingException>(() => task)).Code);
        var second = new Product { Title = "Second bag", Slug = "second-bag", Price = 2000000, StockQuantity = 100, Status = ProductStatus.Active };
        f.Db.Products.Add(second); await f.Db.SaveChangesAsync();
        var mixed = f.Pricing.QuoteAsync([new(f.Product.Id, 5), new(second.Id, quantity - 5)], "freight", null, default);
        if (allowed) Assert.Equal(2, (await mixed).Lines.Count);
        else Assert.Equal("FREIGHT_MIN_QUANTITY", (await Assert.ThrowsAsync<AccountingException>(() => mixed)).Code);
    }

    [Fact]
    public async Task PostalQuote_IsOwnedCachedExpires_AndBindsAddressQuantityAndPolicy()
    {
        await using var f = await Fixture.Create(); var carrier = new FakeCarrier(); var time = new Clock();
        var handler = new ShippingUseCases.QuoteHandler(f.Db, f.Pricing, carrier, time);
        var command = new ShippingUseCases.Quote(f.User, f.Address.Id, [new(f.Product.Id, 2, 1000000)], "post");
        var result = await handler.Handle(command, default);
        Assert.Equal(60000, result.Cost); Assert.Equal(1100, carrier.Weight); Assert.Equal(1, carrier.Calls);
        Assert.Equal(result.Id, (await handler.Handle(command, default)).Id); Assert.Equal(1, carrier.Calls);
        var priced = await f.Pricing.QuoteAsync(command.Items, "post", null, default, result.Id, f.User, f.Address.Id, true);
        Assert.Equal(60000, priced.Freight);
        await Assert.ThrowsAsync<AccountingException>(() => f.Pricing.QuoteAsync(command.Items, "post", null, default, result.Id, Guid.NewGuid(), f.Address.Id, true));
        await Assert.ThrowsAsync<AccountingException>(() => f.Pricing.QuoteAsync([new(f.Product.Id, 3, 1000000)], "post", null, default, result.Id, f.User, f.Address.Id, true));
        f.Address.StreetAddress = "Changed"; await f.Db.SaveChangesAsync();
        await Assert.ThrowsAsync<AccountingException>(() => f.Pricing.QuoteAsync(command.Items, "post", null, default, result.Id, f.User, f.Address.Id, true));
        time.Advance(); var later = await handler.Handle(command, default); Assert.NotEqual(result.Id, later.Id);
        Assert.Equal(2, carrier.Calls);
        f.Db.ShippingQuotes.Single(x => x.Id == later.Id).ExpiresAtUtc = DateTime.UtcNow.AddMinutes(-1); await f.Db.SaveChangesAsync();
        Assert.Equal("SHIPPING_QUOTE_EXPIRED", (await Assert.ThrowsAsync<AccountingException>(() => f.Pricing.QuoteAsync(command.Items, "post", null, default, later.Id, f.User, f.Address.Id, true))).Code);
        using var ambiguous = JsonDocument.Parse("[{\"name\":\"تهران\",\"cities\":[{\"id\":10,\"name\":\"تهران\"},{\"id\":11,\"name\":\"تهران\"}]}]");
        Assert.Throws<AccountingException>(() => PostexCityResolver.Resolve(ambiguous.RootElement, "تهران", "تهران", null));
        Assert.Equal("11", PostexCityResolver.Resolve(ambiguous.RootElement, "تهران", "تهران", "11"));
        Assert.Throws<AccountingException>(() => PostexCityResolver.Resolve(ambiguous.RootElement, "تهران", "تهران", "12"));
    }

    [Fact]
    public async Task FreeOrCollectNeverCallsCarrier_AndUnquotedPostCannotBecomeFree()
    {
        await using var f = await Fixture.Create(); var carrier = new FakeCarrier();
        var handler = new ShippingUseCases.QuoteHandler(f.Db, f.Pricing, carrier, TimeProvider.System);
        var command = new ShippingUseCases.Quote(f.User, f.Address.Id, [new(f.Product.Id, 1, 1000000)], "tipax");
        Assert.Equal("collect", (await handler.Handle(command, default)).PaymentMode); Assert.Equal(0, carrier.Calls);
        await Assert.ThrowsAsync<AccountingException>(() => f.Pricing.QuoteAsync(command.Items, "post", null, default, requireShipping: true));
        f.Policy.IncludedInPrice = true; f.Policy.Version++; await f.Db.SaveChangesAsync();
        Assert.Equal("free", (await handler.Handle(command with { Method = "post", Items = [new(f.Product.Id, 1, 1250000)] }, default)).PaymentMode);
        Assert.Equal(0, carrier.Calls);
    }

    [Fact]
    public async Task SettingsRejectOverlapAndStaleVersion_AndPreserveMeasuredWeights()
    {
        await using var f = await Fixture.Create(); var handler = new ShippingUseCases.SaveHandler(f.Db, new FakeCarrier(), TimeProvider.System);
        var edit = new ShippingPolicy { IncludedInPrice = true, UnitAmount = 250000, Version = 1 };
        var package = new ShippingPackage(1, 10, 100, 40, 30, 20, 1);
        await Assert.ThrowsAsync<AccountingException>(() => handler.Handle(new(edit, [package, package with { MinQuantity = 10, MaxQuantity = 20 }]), default));
        var saved = await handler.Handle(new(edit, [package]), default); Assert.Equal(2, saved.Policy.Version);
        await Assert.ThrowsAsync<AccountingException>(() => handler.Handle(new(edit, [package]), default));
        Assert.Equal(500, f.Product.WeightGrams); Assert.Equal(1000000, f.Product.Price);
    }

    [Fact]
    public void FinancialLinesSnapshotTheIncludedAmountWithoutDoubleFreight()
    {
        var line = new FinancialDocumentLine(Guid.NewGuid(), Guid.NewGuid(), 100, "Bag", 2, 1250000, 200000, 0, baseUnitPrice: 1000000, embeddedShippingUnitAmount: 250000);
        Assert.Equal(2300000, line.Net); Assert.Equal(250000, line.EmbeddedShippingUnitAmount);
        Assert.Throws<ArgumentException>(() => new FinancialDocumentLine(Guid.NewGuid(), Guid.NewGuid(), 100, "Bag", 1, 1250000, 1000001, 0, baseUnitPrice: 1000000, embeddedShippingUnitAmount: 250000));
    }

    [Fact]
    public async Task ActualAdapterUsesServerKeyAndOneRateRequest_ConvertsAllComponentsExactlyOnce()
    {
        var wire = new Wire(); var cache = new PostexReadCache();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["Shipping:Postex:ApiKey"] = "local-fixture-key" }).Build();
        var adapter = new PostexRates(wire, config, cache);
        var input = new PostexRateRequest(new ShippingPolicy { OriginCityCode = "1", ServiceType = "PISHTAZ" }, new(1,10,100,40,30,20,1), "10", 1100, 2000000);
        var costs = await Task.WhenAll(Enumerable.Range(0, 12).Select(_ => adapter.QuoteAsync(input, default)));
        Assert.All(costs, value => Assert.Equal(65000, value)); Assert.Equal(1, wire.Count);
        Assert.Equal("https://api.postex.ir/api/v1/shipping/quotes", wire.Uri); Assert.Equal("local-fixture-key", wire.Key);
        var body = JsonDocument.Parse(wire.Body!); Assert.Equal(20000000, body.RootElement.GetProperty("parcels")[0].GetProperty("parcel_properties").GetProperty("total_value").GetDecimal());
        Assert.Throws<AccountingException>(() => PostexRates.ReadCostToman(JsonDocument.Parse("{}").RootElement));
        Assert.Throws<AccountingException>(() => PostexRates.ReadCostToman(JsonDocument.Parse("[]").RootElement));
        Assert.Throws<AccountingException>(() => PostexRates.ReadCostToman(JsonDocument.Parse("{\"shipping_prices\":[{\"service_price\":[{\"totalPrice\":600000}],\"value_added_service_price\":[{}]}]}").RootElement));
        var recoveringWire = new Wire { Malformed = true };
        var recovering = new PostexRates(recoveringWire, config, new PostexReadCache());
        await Assert.ThrowsAsync<AccountingException>(() => recovering.QuoteAsync(input, default));
        recoveringWire.Malformed = false;
        Assert.Equal(65000, await recovering.QuoteAsync(input, default)); Assert.Equal(2, recoveringWire.Count);
    }

    /// <summary>Real SQLite fixture isolated from development and production databases.</summary>
    private sealed class Fixture : IAsyncDisposable
    {
        public SqliteConnection Connection = null!; public AppDbContext Db = null!;
        public Product Product = null!; public ShippingPolicy Policy = null!; public CustomerAddress Address = null!;
        public Guid User; public CartQuotation Pricing => new(Db, TimeProvider.System);
        public static async Task<Fixture> Create()
        {
            var f = new Fixture { Connection = new SqliteConnection("Data Source=:memory:") }; await f.Connection.OpenAsync();
            f.Db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(f.Connection).Options); await f.Db.Database.EnsureCreatedAsync();
            var user = new AppUser { Id = Guid.NewGuid(), FirstName = "Test", LastName = "Buyer", FullName = "Test Buyer", Email = "test@example.invalid", UserName = "test", PhoneNumber = "09121111111", PhoneNumberConfirmed = true };
            f.User = user.Id; f.Product = new Product { Title = "Bag", Slug = "bag", Price = 1000000, WeightGrams = 500, StockQuantity = 100, Status = ProductStatus.Active };
            f.Policy = new ShippingPolicy { OriginCityCode = "10", ServiceType = "PISHTAZ", PackagesJson = JsonSerializer.Serialize(new[] { new ShippingPackage(1, 100, 100, 40, 30, 20, 1) }) };
            f.Address = new CustomerAddress { UserId = f.User, Title = "Home", RecipientName = "Buyer", Province = "تهران", City = "تهران", StreetAddress = "Test street", PostalCode = "1234567890", PhoneNumber = "09121111111" };
            f.Db.AddRange(user, f.Product, f.Policy, f.Address); await f.Db.SaveChangesAsync(); return f;
        }
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await Connection.DisposeAsync(); }
    }

    private sealed class FakeCarrier : IPostexRates
    {
        public bool Configured => true; public int Calls, Weight;
        public Task<decimal> QuoteAsync(PostexRateRequest request, CancellationToken ct) { Calls++; Weight = request.WeightGrams; return Task.FromResult(60000m); }
        public Task<JsonElement> ReferenceAsync(string resource, CancellationToken ct) => Task.FromResult(JsonDocument.Parse(resource == "cities"
            ? "[{\"id\":1,\"name\":\"تهران\",\"cities\":[{\"id\":10,\"name\":\"تهران\"}]}]"
            : "{\"data\":[{\"courierCode\":\"IR_POST\",\"courierServiceCode\":\"PISHTAZ\",\"name\":\"پیشتاز\"}]}").RootElement.Clone());
    }
    private sealed class Clock : TimeProvider
    {
        private DateTimeOffset _now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance() => _now = _now.AddMinutes(11);
    }
    private sealed class Wire : HttpMessageHandler, IHttpClientFactory
    {
        public bool Malformed;
        public int Count; public string? Key, Uri, Body;
        public HttpClient CreateClient(string name) => new(this, false);
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Interlocked.Increment(ref Count); Key = request.Headers.GetValues("x-api-key").Single(); Uri = request.RequestUri!.ToString(); Body = await request.Content!.ReadAsStringAsync(ct);
            await Task.Delay(30, ct);
            return new(HttpStatusCode.OK) { Content = new StringContent(Malformed ? "{}" : "{\"shipping_prices\":[{\"service_price\":[{\"totalPrice\":600000}],\"value_added_service_price\":[{\"price\":{\"totalPrice\":20000}}]}],\"pickup_price\":30000}", Encoding.UTF8, "application/json") };
        }
    }
}
