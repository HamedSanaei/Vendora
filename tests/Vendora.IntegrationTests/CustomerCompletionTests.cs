using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Application.Auth;
using Application.Accounting;
using Application.Interfaces;
using Domain.Entities;
using Infrastructure.Auth;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
using Persistence.Identity;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Uses isolated SQLite/Identity and a recording SMS boundary; never sends real messages or Google credentials.</summary>
public sealed class CustomerCompletionTests
{
    /// <summary>Google/email authentication alone does not satisfy the real identity and verified-phone policy.</summary>
    [Fact]
    public void Completion_RequiresExplicitNamesEmailAndVerifiedPhone()
    {
        var user = CompleteUser(); Assert.True(CustomerProfile.Complete(user));
        user.PhoneNumberConfirmed = false; Assert.False(CustomerProfile.Complete(user));
        user.PhoneNumberConfirmed = true; user.FirstName = ""; Assert.False(CustomerProfile.Complete(user));
        user.FirstName = "Customer"; user.LastName = null; Assert.False(CustomerProfile.Complete(user));
        user.LastName = "Test"; user.Email = "invalid"; Assert.False(CustomerProfile.Complete(user));
    }

    [Theory]
    [InlineData("۰۹۱۲۱۲۳۴۵۶۷", "09121234567")]
    [InlineData("٠٩١٢١٢٣٤٥٦٧", "09121234567")]
    [InlineData("+989121234567", "09121234567")]
    [InlineData("00989121234567", "09121234567")]
    public void Mobile_NormalizesIranianPrefixesAndKeyboardDigits(string input, string expected)
        => Assert.Equal(expected, CustomerProfile.NormalizePhone(input));

    /// <summary>Guests cannot request SMS; API responses never include a code; confirmed facts survive reload.</summary>
    [Fact]
    public async Task PhoneApi_Auth_SingleUse_HashOnly_AndProfileEditsInvalidateVerification()
    {
        var sender = new RecordingSender { Code = "009812" };
        await using var host = await Host(sender);
        var user = CompleteUser(); user.PhoneNumberConfirmed = false;
        await Insert(host, user);
        using var guest = host.Client(null);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PostAsJsonAsync("/api/account/phone/send", new { })).StatusCode);
        using var client = host.Client("Customer"); client.DefaultRequestHeaders.Add("Test-User", user.Id.ToString());
        using var sent = await client.PostAsJsonAsync("/api/account/phone/send", new { phoneNumber = "09129999999", phoneNumberConfirmed = true });
        Assert.Equal(HttpStatusCode.OK, sent.StatusCode); Assert.Equal(user.PhoneNumber, sender.Phone);
        Assert.DoesNotContain(sender.Code, await sent.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync("/api/account/phone/send", new { })).StatusCode);
        using (var scope = host.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var row = await db.PhoneVerifications.SingleAsync();
            Assert.NotEqual(sender.Code, row.CodeHash); Assert.NotNull(row.CodeHash);
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/account/phone/confirm", new { code = "000000" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/account/phone/confirm", new { code = sender.Code })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/account/phone/confirm", new { code = sender.Code })).StatusCode);
        var current = await client.GetFromJsonAsync<Account.CurrentAccountDto>("/api/account/me");
        Assert.True(current!.Completion!.IsComplete);
        using var unchanged = await client.PutAsJsonAsync("/api/account/profile", new { fullName = user.FullName, firstName = "Customer", lastName = "Test", email = user.Email, phoneNumber = user.PhoneNumber });
        Assert.Equal(HttpStatusCode.OK, unchanged.StatusCode);
        Assert.True((await client.GetFromJsonAsync<Account.CurrentAccountDto>("/api/account/me"))!.Completion!.PhoneNumberConfirmed);
        using var invalidName = await client.PutAsJsonAsync("/api/account/profile", new { fullName = "", firstName = "", lastName = "Test", email = user.Email, phoneNumber = user.PhoneNumber });
        Assert.Equal(HttpStatusCode.BadRequest, invalidName.StatusCode);
        using var saved = await client.PutAsJsonAsync("/api/account/profile", new { fullName = user.FullName, firstName = "نام", lastName = "خانوادگی", email = user.Email, phoneNumber = "۰۹۱۲۲۲۲۲۲۲۲", phoneNumberConfirmed = true });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        current = await client.GetFromJsonAsync<Account.CurrentAccountDto>("/api/account/me");
        Assert.False(current!.Completion!.PhoneNumberConfirmed); Assert.False(current.Completion.IsComplete);
        Assert.Equal("09122222222", current.PhoneNumber); Assert.Equal("نام خانوادگی", current.FullName);
    }

    /// <summary>Expiry, failed delivery, bounded guesses, repeated sends and stale profile stamps all fail closed.</summary>
    [Fact]
    public async Task Challenges_EnforceExpiryAttemptBudgetAndDeliveryFailure()
    {
        var sender = new RecordingSender(); await using var host = await Host(sender);
        var user = CompleteUser(); user.PhoneNumberConfirmed = false; await Insert(host, user);
        using var scope = host.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var clock = new Clock(); var send = new PhoneConfirmation.SendHandler(db, sender, clock); var confirm = new PhoneConfirmation.ConfirmHandler(db, clock);
        Assert.Equal(200, (await send.Handle(new(user.Id), default)).Status);
        for (int i = 0; i < 5; i++) Assert.Equal(400, (await confirm.Handle(new(user.Id, "000000"), default)).Status);
        Assert.Equal(429, (await confirm.Handle(new(user.Id, sender.Code), default)).Status);
        clock.Now = clock.Now.AddMinutes(6);
        Assert.Equal(400, (await confirm.Handle(new(user.Id, sender.Code), default)).Status);
        sender.Fail = true; Assert.Equal(503, (await send.Handle(new(user.Id), default)).Status);
        Assert.Null((await db.PhoneVerifications.SingleAsync()).CodeHash);
        Assert.Equal(400, (await confirm.Handle(new(user.Id, sender.Code), default)).Status);
        clock.Now = clock.Now.AddMinutes(3); sender.Fail = false;
        Assert.Equal(200, (await send.Handle(new(user.Id), default)).Status);
        var actor = await db.Users.SingleAsync(); actor.ConcurrencyStamp = Guid.NewGuid().ToString(); await db.SaveChangesAsync();
        Assert.Equal(400, (await confirm.Handle(new(user.Id, sender.Code), default)).Status);
        Assert.False(actor.PhoneNumberConfirmed);
        for (int i = 0; i < 2; i++) { clock.Now = clock.Now.AddMinutes(3); Assert.Equal(200, (await send.Handle(new(user.Id), default)).Status); }
        clock.Now = clock.Now.AddMinutes(3); Assert.Equal(429, (await send.Handle(new(user.Id), default)).Status);
    }

    /// <summary>Direct HTTP commerce calls cannot bypass completion, create orders/documents or mutate inventory.</summary>
    [Fact]
    public async Task IncompleteCustomer_CannotOrderQuoteOrPostContent()
    {
        await using var host = await Host(new RecordingSender()); var user = CompleteUser(); user.PhoneNumberConfirmed = false; await Insert(host, user);
        using var client = host.Client("Customer"); client.DefaultRequestHeaders.Add("Test-User", user.Id.ToString());
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/orders", new { items = Array.Empty<object>() })).StatusCode);
        client.DefaultRequestHeaders.Add("Idempotency-Key", "incomplete-customer");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/account/documents/proformas", new { items = Array.Empty<object>() })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/products/{Guid.NewGuid()}/discussion/questions", new { content = "Question" })).StatusCode);
        using var scope = host.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await db.Orders.ToListAsync()); Assert.Empty(await db.FinancialDocuments.ToListAsync()); Assert.Empty(await db.StockMovements.ToListAsync());
    }

    /// <summary>Stale parallel reads cannot successfully consume the same challenge twice.</summary>
    [Fact]
    public async Task StaleConcurrentConfirmation_CannotConsumeCodeTwice()
    {
        var sender = new RecordingSender(); await using var host = await Host(sender);
        var user = CompleteUser(); user.PhoneNumberConfirmed = false; await Insert(host, user);
        using var scope = host.App.Services.CreateScope(); var first = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await new PhoneConfirmation.SendHandler(first, sender, TimeProvider.System).Handle(new(user.Id), default);
        await using var second = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(first.Database.GetDbConnection()).Options);
        await second.Users.SingleAsync(); await second.PhoneVerifications.SingleAsync();
        Assert.Equal(200, (await new PhoneConfirmation.ConfirmHandler(first, TimeProvider.System).Handle(new(user.Id, sender.Code), default)).Status);
        Assert.Equal(409, (await new PhoneConfirmation.ConfirmHandler(second, TimeProvider.System).Handle(new(user.Id, sender.Code), default)).Status);
        first.ChangeTracker.Clear(); Assert.Null((await first.PhoneVerifications.SingleAsync()).CodeHash);
    }

    /// <summary>Missing provider configuration cannot confirm a phone or pretend that an SMS was sent.</summary>
    [Fact]
    public async Task UnconfiguredSms_IsUnavailableWithoutMarkingConfirmed()
    {
        var sender = new RecordingSender { Configured = false }; await using var host = await Host(sender);
        var user = CompleteUser(); user.PhoneNumberConfirmed = false; await Insert(host, user);
        using var scope = host.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(503, (await new PhoneConfirmation.SendHandler(db, sender, TimeProvider.System).Handle(new(user.Id), default)).Status);
        Assert.Null(sender.Phone); Assert.False((await db.Users.SingleAsync()).PhoneNumberConfirmed);
    }

    /// <summary>Tests the actual published XML contract using a local HTTP recording handler, never a real provider account.</summary>
    [Theory]
    [InlineData("1", "654321", "654321")]
    [InlineData("-1", "654321", null)]
    [InlineData("1", "not-a-code", null)]
    public async Task ParsGreen_RequiresPositiveProviderResultAndNumericCode(string result, string code, string? expected)
    {
        var transport = new SmsTransport(result, code); using var client = new HttpClient(transport);
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Sms:ParsGreen:Signature"] = "synthetic-test-signature" }).Build();
        var sender = new ParsGreenPhoneCodeSender(client, config);
        Assert.Equal(expected, await sender.SendAsync("09121111111", default));
        Assert.Contains("<patternId>3</patternId>", transport.Body); Assert.Contains("<mobile>09121111111</mobile>", transport.Body);
        Assert.Equal("https://login.parsgreen.com/Api/SendSMS.asmx", transport.Url);
    }

    /// <summary>Creates an isolated MVC/Identity host with a replacement SMS boundary and normal accounting dependencies.</summary>
    private static Task<ProductArticleTests.ArticleHost> Host(RecordingSender sender) => ProductArticleTests.ArticleHost.CreateAsync(services =>
    {
        services.AddIdentityCore<AppUser>().AddRoles<IdentityRole<Guid>>().AddEntityFrameworkStores<AppDbContext>();
        services.AddSingleton<IPhoneCodeSender>(sender); services.AddScoped<AccountingUnitOfWork>(); services.AddScoped<CartQuotation>();
        services.AddScoped<Persistence.Carts.ICartRepository, Persistence.Carts.CartRepository>(); services.AddScoped<Persistence.Orders.IOrderRepository, Persistence.Orders.OrderRepository>();
    });

    /// <summary>Persists only a synthetic test customer, never auto-confirming real user data.</summary>
    private static async Task Insert(ProductArticleTests.ArticleHost host, AppUser user)
    {
        using var scope = host.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); db.Users.Add(user); await db.SaveChangesAsync();
    }

    private static AppUser CompleteUser() => new() { UserName = Guid.NewGuid().ToString(), SecurityStamp = Guid.NewGuid().ToString(), FullName = "Customer Test", FirstName = "Customer", LastName = "Test", Email = "customer@example.invalid", PhoneNumber = "09121111111", PhoneNumberConfirmed = true };
    private sealed class Clock : TimeProvider { public DateTimeOffset Now { get; set; } = DateTimeOffset.UtcNow; public override DateTimeOffset GetUtcNow() => Now; }
    private sealed class RecordingSender : IPhoneCodeSender
    {
        public bool Configured { get; set; } = true; public bool IsConfigured => Configured; public bool Fail { get; set; }
        public string Code { get; set; } = "654321"; public string? Phone { get; private set; }
        public Task<string?> SendAsync(string phone, CancellationToken ct) { Phone = phone; return Task.FromResult<string?>(Fail ? null : Code); }
    }
    private sealed class SmsTransport(string result, string code) : HttpMessageHandler
    {
        public string Body { get; private set; } = ""; public string? Url { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Body = await request.Content!.ReadAsStringAsync(ct); Url = request.RequestUri!.ToString();
            return new(HttpStatusCode.OK) { Content = new StringContent($"<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body><SendOtpResponse xmlns=\"http://ParsGreen.com/\"><SendOtpResult>{result}</SendOtpResult><otpCode>{code}</otpCode></SendOtpResponse></soap:Body></soap:Envelope>", Encoding.UTF8, "text/xml") };
        }
    }
}
