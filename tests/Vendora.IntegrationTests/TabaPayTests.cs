using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using Application.Accounting;
using Application.Interfaces;
using Application.Payments;
using Application.Sms;
using Domain.Accounting;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Payments;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Persistence;
using Persistence.Identity;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Exercises real payment controllers, database writes and the provider adapter with isolated HTTP responses.</summary>
public sealed class TabaPayTests
{
    private const string Merchant = "3ca8819c-de58-42ca-8030-eaf6a2a319d6";
    private const long Rial = 120_000;
    private const string OrderNumber = "ORD-TABAPAY-TEST";
    private static string OrderUrl => $"/api/payments/tabapay/orders/{OrderNumber}";

    [Fact]
    public async Task Start_RequiresOwnerAndDeduplicatesConcurrentRequests()
    {
        var transport = new GatewayTransport { HoldCreate = true };
        await using var host = await CreateAsync(transport);
        Guid owner = await SeedOrderAsync(host);
        using var guest = host.Client(null);
        using var other = Customer(host, Guid.NewGuid());
        using var buyer = Customer(host, owner);
        Assert.Equal(HttpStatusCode.Unauthorized, (await StartAsync(guest)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync(OrderUrl)).StatusCode);
        var starting = StartAsync(buyer);
        await transport.CreateEntered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        try { Assert.Equal(HttpStatusCode.Conflict, (await StartAsync(buyer)).StatusCode); }
        finally { transport.ReleaseCreate.TrySetResult(); }
        var result = await (await starting).Content.ReadFromJsonAsync<TabaPayPayments.StartView>();
        var repeat = await (await StartAsync(buyer)).Content.ReadFromJsonAsync<TabaPayPayments.StartView>();
        Assert.Equal(result, repeat);
        Assert.Equal($"https://api.tabapay.ir/pay/{transport.Token}", result!.Url);
        Assert.Equal(1, transport.Creates);
    }

    [Fact]
    public async Task BrowserReturn_DoesNotTrustQuery_AndRetryPreservesOrderAndStock()
    {
        var transport = new GatewayTransport { VerificationCode = -101 };
        await using var host = await CreateAsync(transport);
        Guid owner = await SeedOrderAsync(host);
        using var buyer = Customer(host, owner);
        using var browser = CallbackClient(host);
        (await StartAsync(buyer, "en")).EnsureSuccessStatusCode();
        var rejected = await browser.GetAsync(transport.Callback!.PathAndQuery + $"?token={transport.Token}&responseCode=1&amount=1");
        Assert.Equal(HttpStatusCode.Redirect, rejected.StatusCode);
        Assert.Equal($"https://shop.example/en/order/{OrderNumber}", rejected.Headers.Location!.AbsoluteUri);
        Assert.Equal("failed", (await ReadAsync(buyer)).State);
        Assert.True((await ReadAsync(buyer)).CanRetry);

        string failedToken = transport.Token;
        (await StartAsync(buyer)).EnsureSuccessStatusCode();
        Assert.NotEqual(failedToken, transport.Token);
        transport.VerificationCode = 2;
        var callback = transport.Callback!.PathAndQuery + $"?token={transport.Token}";
        Assert.Equal(HttpStatusCode.Redirect, (await browser.GetAsync(callback)).StatusCode);
        Assert.Equal(HttpStatusCode.Redirect, (await browser.GetAsync(callback)).StatusCode);
        var result = await ReadAsync(buyer);
        Assert.Equal("paid", result.State);
        Assert.Equal("111122223333", result.Reference);
        Assert.False(result.CanRetry);
        Assert.Equal(2, transport.Verifies);
        using var scope = host.App.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(OrderStatus.Paid, (await db.Orders.SingleAsync()).Status);
        Assert.Equal(4, (await db.Products.SingleAsync()).StockQuantity);
        Assert.Single(await db.PaymentTransactions.Where(p => p.VerifiedAtUtc != null).ToListAsync());
    }

    [Fact]
    public async Task AutomaticVerification_RejectsForgeryAndMismatches_AndPostsOnce()
    {
        var transport = new GatewayTransport();
        await using var host = await CreateAsync(transport);
        using var buyer = Customer(host, await SeedOrderAsync(host, accounting: true));
        using var carrier = CallbackClient(host);
        (await StartAsync(buyer)).EnsureSuccessStatusCode();
        string signature = Convert.ToHexString(MD5.HashData(Encoding.ASCII.GetBytes(Merchant)));
        async Task<HttpResponseMessage> Notify(string header, long amount)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, transport.Callback!.PathAndQuery);
            request.Headers.Add("Authorize", header);
            request.Content = JsonContent.Create(new { responseCode = 1, status = "success", token = transport.Token,
                amount, finalAmount = amount - 500, shaparakRefNumber = "111122223333", cardNumber = "1234-56**-****-7890" });
            return await carrier.SendAsync(request);
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await Notify(new string('0', 32), Rial)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Notify(signature, Rial + 10)).StatusCode);
        Assert.Equal("pending", (await ReadAsync(buyer)).State);
        (await Notify(signature, Rial)).EnsureSuccessStatusCode();
        (await Notify(signature, Rial)).EnsureSuccessStatusCode();
        Assert.Equal("paid", (await ReadAsync(buyer)).State);
        using var scope = host.App.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(Rial / 10, (await db.Settlements.SingleAsync()).AmountToman);
        Assert.Single(await db.FinancialDocuments.Where(x => x.Kind == DocumentKind.Sale).ToListAsync());
        Assert.Equal(ReservationStatus.Consumed, (await db.StockReservations.SingleAsync()).Status);
        Assert.Equal(4, (await db.InventoryBalances.SingleAsync()).OnHand);
        Assert.Equal(64, (await db.PaymentTransactions.SingleAsync()).VerificationEvidenceDigest!.Length);
    }

    [Fact]
    public async Task InvalidRedirectAndIncompleteEvidence_CannotMarkOrderPaid()
    {
        var transport = new GatewayTransport { ForeignRedirect = true };
        await using var host = await CreateAsync(transport);
        using var buyer = Customer(host, await SeedOrderAsync(host));
        using var browser = CallbackClient(host);
        Assert.Equal(HttpStatusCode.BadGateway, (await StartAsync(buyer)).StatusCode);
        transport.ForeignRedirect = false;
        (await StartAsync(buyer)).EnsureSuccessStatusCode();
        transport.AmountOffset = 10;
        Assert.Equal(HttpStatusCode.Redirect, (await browser.GetAsync(transport.Callback!.PathAndQuery + $"?token={transport.Token}")).StatusCode);
        Assert.Equal("pending", (await ReadAsync(buyer)).State);
        transport.AmountOffset = 0;
        transport.VerificationCode = 2;
        transport.IncludeReference = false;
        (await buyer.PostAsJsonAsync(OrderUrl + "/check", new { locale = "fa" })).EnsureSuccessStatusCode();
        Assert.Equal("pending", (await ReadAsync(buyer)).State);
    }

    private static Task<HttpResponseMessage> StartAsync(HttpClient client, string locale = "fa") =>
        client.PostAsJsonAsync(OrderUrl + "/start", new { locale });

    private static async Task<TabaPayPayments.PaymentView> ReadAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<TabaPayPayments.PaymentView>(OrderUrl))!;

    private static HttpClient Customer(ProductArticleTests.ArticleHost host, Guid owner)
    {
        var client = host.Client("Customer");
        client.DefaultRequestHeaders.Add("Test-User", owner.ToString());
        return client;
    }

    private static HttpClient CallbackClient(ProductArticleTests.ArticleHost host)
    {
        using var guest = host.Client(null);
        return new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { BaseAddress = guest.BaseAddress };
    }

    private static Task<ProductArticleTests.ArticleHost> CreateAsync(GatewayTransport transport) =>
        ProductArticleTests.ArticleHost.CreateAsync(services =>
        {
            services.AddScoped<AccountingUnitOfWork>();
            services.AddScoped<InventoryPosting>();
            services.AddScoped<OrderReservations>();
            services.AddScoped<DocumentPosting>();
            services.AddScoped<SmsNotifications>();
            services.AddSingleton<ITabaPayGateway>(provider => new TabaPayGateway(new HttpClient(transport),
                new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
                    ["Payments:TabaPay:Merchant"] = Merchant, ["Payments:TabaPay:CallbackOrigin"] = "https://callback.example",
                    ["Payments:TabaPay:StorefrontOrigin"] = "https://shop.example", ["Payments:TabaPay:Sandbox"] = "false"
                }).Build(), provider.GetRequiredService<IHostEnvironment>()));
        });

    private static async Task<Guid> SeedOrderAsync(ProductArticleTests.ArticleHost host, bool accounting = false)
    {
        using var scope = host.App.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = new AppUser { Id = Guid.NewGuid(), FirstName = "Test", LastName = "Buyer", FullName = "Test Buyer",
            UserName = "payment-buyer", Email = "buyer@example.invalid", PhoneNumber = "09121111111", PhoneNumberConfirmed = true };
        var product = new Product { Title = "Bag", Slug = "test-tabapay-bag", CategoryId = host.CategoryId, Price = 12_000m, StockQuantity = 4 };
        var order = new Order { OrderNumber = OrderNumber, UserId = user.Id, ShippingRecipientName = user.FullName,
            ShippingPhoneNumber = user.PhoneNumber };
        var item = new OrderItem { ProductId = product.Id, ProductTitle = product.Title, Quantity = 1, UnitPrice = 12_000m };
        order.Items.Add(item);
        order.RecalculateTotals();
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.AcquireAccountingWriteGateAsync(default);
        db.AddRange(user, product, order);
        if (accounting)
        {
            var state = await db.AccountingStates.SingleAsync();
            state.Activated = true;
            state.ActivatedAtUtc = DateTime.UtcNow.AddHours(-1);
            var balance = new InventoryBalance(product.Id);
            balance.Receive(5, 5000);
            db.InventoryBalances.Add(balance);
            var inventory = scope.ServiceProvider.GetRequiredService<InventoryPosting>();
            await inventory.RecordAsync(balance, "test-opening-stock", StockMovementKind.Purchase,
                5, 0, 5000, user.Id, "Test opening stock", default);
            await scope.ServiceProvider.GetRequiredService<OrderReservations>().ReserveAsync(order, item, user.Id, default);
        }
        await db.SaveChangesAsync();
        await transaction.CommitAsync();
        return user.Id;
    }

    private sealed class GatewayTransport : HttpMessageHandler
    {
        public TaskCompletionSource CreateEntered { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public TaskCompletionSource ReleaseCreate { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public bool HoldCreate { get; init; }
        public bool ForeignRedirect { get; set; }
        public bool IncludeReference { get; set; } = true;
        public int VerificationCode { get; set; } = 1;
        public int AmountOffset { get; set; }
        public int Creates { get; private set; }
        public int Verifies { get; private set; }
        public string Token { get; private set; } = "";
        public Uri? Callback { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Equal("api.tabapay.ir", request.RequestUri!.Host);
            Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
            Assert.Equal(Merchant, request.Headers.Authorization?.Parameter);
            var form = new Dictionary<string, string>();
            foreach (var part in Assert.IsType<MultipartFormDataContent>(request.Content))
                form[part.Headers.ContentDisposition!.Name!.Trim('"')] = await part.ReadAsStringAsync(ct);
            Assert.Equal(Rial.ToString(), form["amount"]);
            if (request.RequestUri.AbsolutePath == "/v1/create")
            {
                Creates++;
                Token = Guid.NewGuid().ToString();
                Callback = new Uri(form["callbackURL"]);
                Assert.Equal("callback.example", Callback.Host);
                CreateEntered.TrySetResult();
                if (HoldCreate) await ReleaseCreate.Task.WaitAsync(ct);
                return Json(new { responseCode = 1, status = "success", token = Token,
                    url = $"https://{(ForeignRedirect ? "foreign.example" : "api.tabapay.ir")}/pay/{Token}" });
            }
            Assert.Equal("/v1/verify", request.RequestUri.AbsolutePath);
            Assert.Equal(Token, form["token"]);
            Verifies++;
            return Json(new { responseCode = VerificationCode, status = VerificationCode > 0 ? "success" : "error",
                token = Token, amount = Rial + AmountOffset, finalAmount = Rial - 500,
                shaparakRefNumber = IncludeReference ? "111122223333" : null });
        }

        private static HttpResponseMessage Json(object value) => new(HttpStatusCode.OK) { Content = JsonContent.Create(value) };
    }
}
