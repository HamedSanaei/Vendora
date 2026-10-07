using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using API.Controllers;
using Application.Auth;
using Application.Orders.DTOs;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Persistence;
using Persistence.Carts;
using Persistence.Common;
using Persistence.Orders;
using Persistence.Products;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Exercises selected locations through real account and checkout APIs with isolated SQLite storage.</summary>
public sealed class AddressCoordinatesTests
{
    private static readonly Guid Owner = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Other = Guid.Parse("22222222-2222-2222-2222-222222222222");

    /// <summary>Selected locations persist across create, update and list, including zero and global boundaries.</summary>
    [Theory]
    [InlineData(0, 0)]
    [InlineData(-90, -180)]
    [InlineData(90, 180)]
    [InlineData(35.6892, 51.3890)]
    public async Task AddressCoordinates_RoundTripAndClear(double latitude, double longitude)
    {
        await using var host = await AddressHost.CreateAsync();
        using var client = host.CreateClient(Owner);
        var address = await CreateAddressAsync(client, Address(latitude, longitude));
        Assert.Equal(latitude, address.Latitude);
        Assert.Equal(longitude, address.Longitude);
        var listed = Assert.Single((await client.GetFromJsonAsync<Account.AddressDto[]>("/api/account/addresses"))!);
        Assert.Equal(address, listed);

        using var update = await client.PutAsJsonAsync($"/api/account/addresses/{address.Id}", Address(1, 2));
        update.EnsureSuccessStatusCode();
        var updated = Assert.Single((await update.Content.ReadFromJsonAsync<Account.AddressDto[]>())!);
        Assert.Equal(1d, updated.Latitude);
        Assert.Equal(2d, updated.Longitude);
        using var clear = await client.PutAsJsonAsync($"/api/account/addresses/{address.Id}", Address());
        clear.EnsureSuccessStatusCode();
        var cleared = Assert.Single((await client.GetFromJsonAsync<Account.AddressDto[]>("/api/account/addresses"))!);
        Assert.Null(cleared.Latitude);
        Assert.Null(cleared.Longitude);
        using var scope = host.App.Services.CreateScope();
        var persisted = await scope.ServiceProvider.GetRequiredService<AppDbContext>().CustomerAddresses.SingleAsync();
        Assert.Null(persisted.Latitude);
        Assert.Null(persisted.Longitude);
        Assert.True(persisted.IsDefault);
    }

    /// <summary>Older account request bodies without coordinate fields remain valid and snapshot no location.</summary>
    [Fact]
    public async Task LegacyAddressRequest_OmittedCoordinatesRemainNull()
    {
        await using var host = await AddressHost.CreateAsync();
        using var client = host.CreateClient(Owner);
        using var response = await client.PostAsJsonAsync("/api/account/addresses", new
        {
            title = "Legacy", recipientName = "Recipient", phoneNumber = "09123456789",
            province = "Province", city = "City", streetAddress = "Street",
            postalCode = "1234567890", isDefault = true
        });
        response.EnsureSuccessStatusCode();
        var address = Assert.Single((await response.Content.ReadFromJsonAsync<Account.AddressDto[]>())!);
        Assert.Null(address.Latitude);
        Assert.Null(address.Longitude);
        using var checkout = await client.PostAsJsonAsync("/api/orders", Order(host.ProductId, address.Id));
        checkout.EnsureSuccessStatusCode();
        var order = (await checkout.Content.ReadFromJsonAsync<OrderDto>())!;
        Assert.Null(order.ShippingAddress.Latitude);
        Assert.Null(order.ShippingAddress.Longitude);
    }

    /// <summary>Invalid HTTP pairs cannot create records, replace existing locations or change defaults.</summary>
    [Theory]
    [InlineData(null, 51d)]
    [InlineData(35d, null)]
    [InlineData(-90.0001, 0d)]
    [InlineData(90.0001, 0d)]
    [InlineData(0d, -180.0001)]
    [InlineData(0d, 180.0001)]
    public async Task InvalidCoordinates_RejectWithoutMutation(double? latitude, double? longitude)
    {
        await using var host = await AddressHost.CreateAsync();
        using var client = host.CreateClient(Owner);
        var original = await CreateAddressAsync(client, Address(35, 51));
        var second = await CreateAddressAsync(client, Address() with { IsDefault = false, Title = "Second" });
        var invalid = Address(latitude, longitude) with { Title = "Must not persist", IsDefault = true };
        using var create = await client.PostAsJsonAsync("/api/account/addresses", invalid);
        using var update = await client.PutAsJsonAsync($"/api/account/addresses/{second.Id}", invalid);
        Assert.Equal(HttpStatusCode.BadRequest, create.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
        var addresses = (await client.GetFromJsonAsync<Account.AddressDto[]>("/api/account/addresses"))!;
        Assert.Equal(2, addresses.Length);
        Assert.Equal(original, addresses.Single(x => x.Id == original.Id));
        Assert.Equal(second, addresses.Single(x => x.Id == second.Id));
    }

    /// <summary>Nonfinite values are rejected at the use-case boundary even outside JSON transport.</summary>
    [Theory]
    [InlineData(double.NaN, 0)]
    [InlineData(double.PositiveInfinity, 0)]
    [InlineData(double.NegativeInfinity, 0)]
    [InlineData(0, double.NaN)]
    [InlineData(0, double.PositiveInfinity)]
    [InlineData(0, double.NegativeInfinity)]
    public async Task NonfiniteCoordinates_RejectAccountAndCheckoutWithoutMutation(double latitude, double longitude)
    {
        await using var host = await AddressHost.CreateAsync();
        using var client = host.CreateClient(Owner);
        var original = await CreateAddressAsync(client, Address(35, 51));
        using var scope = host.App.Services.CreateScope();
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();
        var input = new Account.AddressInput("Changed", "Recipient", "09123456789", "Province", "City", "Street", null, null, "1234567890", true, latitude, longitude);
        Assert.False((await sender.Send(new Account.CreateAddress.Command(Owner, input))).Succeeded);
        Assert.False((await sender.Send(new Account.UpdateAddress.Command(Owner, original.Id, input))).Succeeded);
        var checkout = new Application.Orders.Create.AddressInput("Changed", "Recipient", "09123456789", "Province", "City", "Street", null, null, "1234567890", true, true, latitude, longitude);
        await Assert.ThrowsAsync<InvalidOperationException>(() => sender.Send(new Application.Orders.Create.Command(
            Owner, 0, 0, null, checkout, [new(host.ProductId, 1)])));
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var persisted = await db.CustomerAddresses.SingleAsync();
        Assert.Equal(original.Title, persisted.Title);
        Assert.Equal(original.Latitude, persisted.Latitude);
        Assert.Equal(original.Longitude, persisted.Longitude);
        Assert.True(persisted.IsDefault);
        Assert.Empty(await db.Orders.ToListAsync());
        Assert.Equal(10, (await db.Products.SingleAsync()).StockQuantity);
    }

    /// <summary>Ownership prevents listing, editing, deleting and checking out with another customer's address.</summary>
    [Fact]
    public async Task AddressOwnership_ProtectsSelectedLocation()
    {
        await using var host = await AddressHost.CreateAsync();
        using var owner = host.CreateClient(Owner);
        using var other = host.CreateClient(Other);
        var original = await CreateAddressAsync(owner, Address(35, 51));
        Assert.Empty((await other.GetFromJsonAsync<Account.AddressDto[]>("/api/account/addresses"))!);
        using var update = await other.PutAsJsonAsync($"/api/account/addresses/{original.Id}", Address(0, 0));
        using var delete = await other.DeleteAsync($"/api/account/addresses/{original.Id}");
        using var checkout = await other.PostAsJsonAsync("/api/orders", Order(host.ProductId, original.Id));
        Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, delete.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, checkout.StatusCode);
        Assert.Equal(original, Assert.Single((await owner.GetFromJsonAsync<Account.AddressDto[]>("/api/account/addresses"))!));
        using var anonymous = host.CreateClient(null);
        using var read = await anonymous.GetAsync("/api/account/addresses");
        using var create = await anonymous.PostAsJsonAsync("/api/account/addresses", Address(35, 51));
        Assert.Equal(HttpStatusCode.Unauthorized, read.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, create.StatusCode);
    }

    /// <summary>Customer and admin shipping DTOs retain the checkout location after the source is edited and deleted.</summary>
    [Fact]
    public async Task SavedLocation_IsImmutableOrderSnapshot()
    {
        await using var host = await AddressHost.CreateAsync();
        using var client = host.CreateClient(Owner);
        var source = await CreateAddressAsync(client, Address(35.6892, 51.3890));
        using var response = await client.PostAsJsonAsync("/api/orders", Order(host.ProductId, source.Id));
        response.EnsureSuccessStatusCode();
        var order = (await response.Content.ReadFromJsonAsync<OrderDto>())!;
        Assert.Equal(source.Latitude, order.ShippingAddress.Latitude);
        Assert.Equal(source.Longitude, order.ShippingAddress.Longitude);
        using var update = await client.PutAsJsonAsync($"/api/account/addresses/{source.Id}", Address(0, 0));
        update.EnsureSuccessStatusCode();
        await AssertSnapshotAsync(host, order, source);
        using var delete = await client.DeleteAsync($"/api/account/addresses/{source.Id}");
        delete.EnsureSuccessStatusCode();
        await AssertSnapshotAsync(host, order, source);
    }

    /// <summary>New-address checkout supports coordinates with or without saving and supports legacy omitted coordinates.</summary>
    [Theory]
    [InlineData(true, 0d, 0d)]
    [InlineData(false, 90d, 180d)]
    [InlineData(true, null, null)]
    [InlineData(false, null, null)]
    public async Task NewCheckoutAddress_SnapshotsOptionalCoordinates(bool save, double? latitude, double? longitude)
    {
        await using var host = await AddressHost.CreateAsync();
        using var client = host.CreateClient(Owner);
        var address = new CreateOrderAddressRequest("Home", "Recipient", "09123456789", "Province", "City", "Street", null, null, "1234567890", save, true, latitude, longitude);
        using var response = await client.PostAsJsonAsync("/api/orders", Order(host.ProductId, null) with { NewAddress = address });
        response.EnsureSuccessStatusCode();
        var order = (await response.Content.ReadFromJsonAsync<OrderDto>())!;
        Assert.Equal(latitude, order.ShippingAddress.Latitude);
        Assert.Equal(longitude, order.ShippingAddress.Longitude);
        using var scope = host.App.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persisted = await db.Orders.SingleAsync();
        Assert.Equal(latitude, persisted.ShippingLatitude);
        Assert.Equal(longitude, persisted.ShippingLongitude);
        var saved = await db.CustomerAddresses.ToListAsync();
        Assert.Equal(save ? 1 : 0, saved.Count);
        if (save)
        {
            Assert.Equal(latitude, saved[0].Latitude);
            Assert.Equal(longitude, saved[0].Longitude);
        }
    }

    /// <summary>Checkout rejects invalid locations before saving addresses, clearing defaults or consuming stock.</summary>
    [Theory]
    [InlineData(null, 0d)]
    [InlineData(0d, null)]
    [InlineData(91d, 0d)]
    [InlineData(-91d, 0d)]
    [InlineData(0d, 181d)]
    [InlineData(0d, -181d)]
    public async Task InvalidCheckoutCoordinates_DoNotMutateDatabase(double? latitude, double? longitude)
    {
        await using var host = await AddressHost.CreateAsync();
        using var client = host.CreateClient(Owner);
        var original = await CreateAddressAsync(client, Address(35, 51));
        var address = new CreateOrderAddressRequest("Invalid", "Recipient", "09123456789", "Province", "City", "Street", null, null, "1234567890", true, true, latitude, longitude);
        using var response = await client.PostAsJsonAsync("/api/orders", Order(host.ProductId, null) with { NewAddress = address });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(original, Assert.Single((await client.GetFromJsonAsync<Account.AddressDto[]>("/api/account/addresses"))!));
        using var scope = host.App.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await db.Orders.ToListAsync());
        Assert.Equal(10, (await db.Products.SingleAsync()).StockQuantity);
    }

    /// <summary>Builds a valid address request with an optional selected location.</summary>
    private static AddressRequest Address(double? latitude = null, double? longitude = null) =>
        new("Home", "Recipient", "09123456789", "Province", "City", "Street", null, null, "1234567890", true, latitude, longitude);

    /// <summary>Builds a one-product checkout request using a selected saved address.</summary>
    private static CreateOrderRequest Order(Guid productId, Guid? addressId) => new(0, 0, addressId, null, [new(productId, 1)]);

    /// <summary>Creates an address through MVC and returns the persisted account DTO.</summary>
    private static async Task<Account.AddressDto> CreateAddressAsync(HttpClient client, AddressRequest request)
    {
        using var response = await client.PostAsJsonAsync("/api/account/addresses", request);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Account.AddressDto[]>())!.Single(x => x.Title == request.Title);
    }

    /// <summary>Reads fresh customer, admin and database snapshots after changing the source address.</summary>
    private static async Task AssertSnapshotAsync(AddressHost host, OrderDto order, Account.AddressDto source)
    {
        using var scope = host.App.Services.CreateScope();
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();
        var customer = await sender.Send(new Application.Orders.Details.Query(order.OrderNumber, Owner));
        var admin = await sender.Send(new Application.Admin.Orders.Details.Query(order.Id));
        Assert.NotNull(customer);
        Assert.NotNull(admin);
        Assert.Equal(source.Latitude, customer.ShippingAddress.Latitude);
        Assert.Equal(source.Longitude, customer.ShippingAddress.Longitude);
        Assert.Equal(source.Latitude, admin.Shipping.Latitude);
        Assert.Equal(source.Longitude, admin.Shipping.Longitude);
        var persisted = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Orders.SingleAsync();
        Assert.Equal(source.Latitude, persisted.ShippingLatitude);
        Assert.Equal(source.Longitude, persisted.ShippingLongitude);
    }

    /// <summary>Hosts real MVC and mediator handlers over an isolated relational database without new packages.</summary>
    private sealed class AddressHost : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        public WebApplication App { get; }
        public Uri BaseAddress { get; }
        public Guid ProductId { get; }

        /// <summary>Stores the running host and its per-test database lifetime.</summary>
        private AddressHost(WebApplication app, SqliteConnection connection, Guid productId)
        {
            App = app;
            _connection = connection;
            ProductId = productId;
            BaseAddress = new Uri(app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single());
        }

        /// <summary>Starts an ephemeral HTTP server and seeds a purchasable product.</summary>
        public static async Task<AddressHost> CreateAsync()
        {
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
            builder.Logging.ClearProviders();
            builder.WebHost.ConfigureKestrel(options => options.Listen(IPAddress.Loopback, 0));
            builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(connection));
            builder.Services.AddScoped<IUnitOfWork>(services => services.GetRequiredService<AppDbContext>());
            builder.Services.AddScoped<ICartRepository, CartRepository>();
            builder.Services.AddScoped<IOrderRepository, OrderRepository>();
            builder.Services.AddScoped<IProductReadRepository, ProductReadRepository>();
            builder.Services.AddMediatR(config => config.RegisterServicesFromAssemblyContaining<Account.AddressDto>());
            builder.Services.AddControllers().AddApplicationPart(typeof(AccountController).Assembly);
            builder.Services.AddAuthentication("Test").AddScheme<AuthenticationSchemeOptions, TestAuthenticationHandler>("Test", _ => { });
            builder.Services.AddAuthorization(options => options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin")));
            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();
            var product = new Product { Title = "Test bag", Slug = "test-bag", Price = 100, StockQuantity = 10, Status = ProductStatus.Active };
            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await db.Database.EnsureCreatedAsync();
                db.Products.Add(product);
                await db.SaveChangesAsync();
            }
            await app.StartAsync();
            return new AddressHost(app, connection, product.Id);
        }

        /// <summary>Creates a customer client for the given identity, or an anonymous client.</summary>
        public HttpClient CreateClient(Guid? userId)
        {
            var client = new HttpClient { BaseAddress = BaseAddress };
            if (userId.HasValue) client.DefaultRequestHeaders.Add("Test-User", userId.Value.ToString());
            return client;
        }

        /// <summary>Stops the server and releases only this test's database.</summary>
        public async ValueTask DisposeAsync()
        {
            await App.StopAsync();
            await App.DisposeAsync();
            await _connection.DisposeAsync();
        }
    }

    /// <summary>Supplies test customer identities without changing production authentication.</summary>
    private sealed class TestAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        /// <summary>Creates the test authentication scheme with framework dependencies.</summary>
        public TestAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
            : base(options, logger, encoder) { }

        /// <inheritdoc />
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Guid.TryParse(Request.Headers["Test-User"].ToString(), out var userId))
                return Task.FromResult(AuthenticateResult.NoResult());
            var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, "Customer")], Scheme.Name);
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name)));
        }
    }
}
