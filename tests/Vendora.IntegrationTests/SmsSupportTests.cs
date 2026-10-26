using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Accounting;
using Application.Auth;
using Application.Interfaces;
using Application.Sms;
using Application.Support;
using Domain.Entities;
using Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Persistence;
using Persistence.Identity;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Real controllers/Identity/SQLite with an isolated in-memory carrier. No live SMS, customer data or production configuration.</summary>
public sealed class SmsSupportTests
{
    [Fact]
    public async Task PhoneOnlyProfileCompletion_RenewsStampedSession_AndNewRecoveryInvalidatesPriorGrant()
    {
        await using var f=await Fixture.Create();using var guest=f.Host.Client(null);
        var send=await guest.PostAsJsonAsync("/api/account/otp/request",new{phone="09120000130"});
        Guid id=(await send.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("challengeId").GetGuid();
        var proof=await guest.PostAsJsonAsync("/api/account/otp/verify",new{challengeId=id,code=f.Gateway.Code});
        var account=(await proof.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("account");Guid userId=account.GetProperty("id").GetGuid();
        string stamp=new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(account.GetProperty("token").GetString()).Claims.Single(x=>x.Type=="sst").Value;
        AppUser user;using(var scope=f.Host.App.Services.CreateScope())user=await scope.ServiceProvider.GetRequiredService<AppDbContext>().Users.SingleAsync(x=>x.Id==userId);
        using var customer=f.Client(user,"Customer");
        Assert.Equal(HttpStatusCode.Forbidden,(await Write(customer,"/api/account/tickets",new{subject="Incomplete contact",text="Profile verification required"},"incomplete-profile")).StatusCode);
        var update=await customer.PutAsJsonAsync("/api/account/profile",new{firstName="Fixture",lastName="Customer",fullName="Fixture Customer",email="profile-sms@example.invalid",phoneNumber=user.PhoneNumber});Assert.Equal(HttpStatusCode.OK,update.StatusCode);
        var changed=(await update.Content.ReadFromJsonAsync<JsonElement>());Assert.True(changed.GetProperty("completion").GetProperty("isComplete").GetBoolean());
        string renewed=new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(changed.GetProperty("token").GetString()).Claims.Single(x=>x.Type=="sst").Value;Assert.NotEqual(stamp,renewed);
        using(var scope=f.Host.App.Services.CreateScope()){var sessions=new SessionValidation.Handler(scope.ServiceProvider.GetRequiredService<AppDbContext>(),f.Clock);Assert.False(await sessions.Handle(new(userId,stamp),default));Assert.True(await sessions.Handle(new(userId,renewed),default));}
        f.Clock.Advance(TimeSpan.FromSeconds(121));send=await guest.PostAsJsonAsync("/api/account/password/otp/request",new{phone=user.PhoneNumber});id=(await send.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("challengeId").GetGuid();
        proof=await guest.PostAsJsonAsync("/api/account/password/otp/verify",new{challengeId=id,code=f.Gateway.Code});string grant=(await proof.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("resetGrant").GetString()!;
        f.Clock.Advance(TimeSpan.FromSeconds(121));Assert.Equal(HttpStatusCode.OK,(await guest.PostAsJsonAsync("/api/account/password/otp/request",new{phone=user.PhoneNumber})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await guest.PostAsJsonAsync("/api/account/password/otp/reset",new{challengeId=id,grant,password="Changed123!"})).StatusCode);
    }

    [Fact]
    public async Task ConcurrentProofAndManualRetries_ConsumeOnceAcrossDatabaseConnections()
    {
        await using var f=await Fixture.Create(fileBacked:true);using var guest=f.Host.Client(null);
        var sent=await guest.PostAsJsonAsync("/api/account/otp/request",new{phone="09120000129"});Assert.Equal(HttpStatusCode.OK,sent.StatusCode);
        Guid id=(await sent.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("challengeId").GetGuid();
        var proofs=await Task.WhenAll(Enumerable.Range(0,2).Select(_=>guest.PostAsJsonAsync("/api/account/otp/verify",new{challengeId=id,code=f.Gateway.Code})));
        Assert.Single(proofs,x=>x.StatusCode==HttpStatusCode.OK);Assert.Single(proofs,x=>x.StatusCode==HttpStatusCode.BadRequest);
        var account=(await proofs.Single(x=>x.StatusCode==HttpStatusCode.OK).Content.ReadFromJsonAsync<JsonElement>()).GetProperty("account");Guid customer=account.GetProperty("id").GetGuid();
        var admin=await f.User("Admin","09120000128");using var staff=f.Client(admin,"Admin");
        var sends=await Task.WhenAll(Enumerable.Range(0,2).Select(_=>Write(staff,"/api/admin/sms/send",new{userId=customer,text="Concurrent fixture"},"same-billed-operation")));
        Assert.All(sends,x=>Assert.Equal(HttpStatusCode.OK,x.StatusCode));
        var ids=await Task.WhenAll(sends.Select(async x=>(await x.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid()));Assert.Equal(ids[0],ids[1]);
        using var scope=f.Host.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Single(await db.VerifiedPhoneIdentities.Where(x=>x.Phone=="09120000129").ToListAsync());Assert.Single(await db.SmsMessages.Where(x=>x.Event=="Manual").ToListAsync());
    }
    [Fact]
    public async Task PhoneSignup_IsSingleUsePurposeBound_AndNeverSignsInAdmin()
    {
        await using var f=await Fixture.Create(); using var guest=f.Host.Client(null);
        var sent=await guest.PostAsJsonAsync("/api/account/otp/request",new{phone="09120000109"}); Assert.Equal(HttpStatusCode.OK,sent.StatusCode);
        string json=await sent.Content.ReadAsStringAsync(); Assert.DoesNotContain(f.Gateway.Code,json); Assert.DoesNotContain("fixture-signature",json);
        var challenge=JsonSerializer.Deserialize<JsonElement>(json); Assert.Equal(6,challenge.GetProperty("codeLength").GetInt32());
        var proof=new{challengeId=challenge.GetProperty("challengeId").GetGuid(),code=f.Gateway.Code};
        Assert.Equal(HttpStatusCode.BadRequest,(await guest.PostAsJsonAsync("/api/account/password/otp/verify",proof)).StatusCode);
        var verified=await guest.PostAsJsonAsync("/api/account/otp/verify",proof); Assert.Equal(HttpStatusCode.OK,verified.StatusCode);
        var account=(await verified.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("account");
        Assert.Equal("Customer",account.GetProperty("role").GetString()); Assert.Equal("",account.GetProperty("email").GetString()); Assert.Equal("",account.GetProperty("fullName").GetString());
        Assert.False(account.GetProperty("completion").GetProperty("isComplete").GetBoolean()); Assert.True(account.GetProperty("completion").GetProperty("phoneNumberConfirmed").GetBoolean());
        Assert.Equal(HttpStatusCode.BadRequest,(await guest.PostAsJsonAsync("/api/account/otp/verify",proof)).StatusCode);
        var admin=await f.User("Admin","09120000110"); int count=f.Gateway.CodeCalls;
        sent=await guest.PostAsJsonAsync("/api/account/otp/request",new{phone=admin.PhoneNumber}); Assert.Equal(HttpStatusCode.OK,sent.StatusCode); Assert.Equal(count,f.Gateway.CodeCalls);
        var denied=(await sent.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("challengeId").GetGuid();
        Assert.Equal(HttpStatusCode.BadRequest,(await guest.PostAsJsonAsync("/api/account/otp/verify",new{challengeId=denied,code=f.Gateway.Code})).StatusCode);
        using var staff=f.Client(admin,"Admin"); f.Clock.Advance(TimeSpan.FromSeconds(121));
        var test=await staff.PostAsync("/api/admin/sms/test-code",null); Assert.Equal(HttpStatusCode.OK,test.StatusCode);
        Guid testId=(await test.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("challengeId").GetGuid();
        Assert.Equal(HttpStatusCode.BadRequest,(await guest.PostAsJsonAsync("/api/account/otp/verify",new{challengeId=testId,code=f.Gateway.Code})).StatusCode);
        var checkedTest=await staff.PostAsJsonAsync("/api/admin/sms/test-code/verify",new{challengeId=testId,code=f.Gateway.Code}); Assert.Equal(HttpStatusCode.OK,checkedTest.StatusCode);
        Assert.Equal(JsonValueKind.Null,(await checkedTest.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("account").ValueKind);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Recovery_UsesOneTimeGrant_AndRevokesModernAndLegacySessions(bool passwordExists)
    {
        await using var f=await Fixture.Create(); var user=await f.User("Customer","09120000111",passwordExists); using var guest=f.Host.Client(null);
        string? oldStamp=user.SecurityStamp;
        var sent=await guest.PostAsJsonAsync("/api/account/password/otp/request",new{phone=user.PhoneNumber}); Assert.Equal(HttpStatusCode.OK,sent.StatusCode);
        Guid challenge=(await sent.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("challengeId").GetGuid();
        Assert.Equal(HttpStatusCode.BadRequest,(await guest.PostAsJsonAsync("/api/account/password/otp/verify",new{challengeId=challenge,code="000000"})).StatusCode);
        var proof=await guest.PostAsJsonAsync("/api/account/password/otp/verify",new{challengeId=challenge,code=f.Gateway.Code}); Assert.Equal(HttpStatusCode.OK,proof.StatusCode);
        var data=await proof.Content.ReadFromJsonAsync<JsonElement>(); string grant=data.GetProperty("resetGrant").GetString()!; Assert.Equal(64,grant.Length);
        var payload=new{challengeId=challenge,grant,password="Changed123!"};
        Assert.Equal(HttpStatusCode.OK,(await guest.PostAsJsonAsync("/api/account/password/otp/reset",payload)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await guest.PostAsJsonAsync("/api/account/password/otp/reset",payload)).StatusCode);
        using var scope=f.Host.App.Services.CreateScope(); var db=scope.ServiceProvider.GetRequiredService<AppDbContext>(); var users=scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var fresh=(await users.FindByIdAsync(user.Id.ToString()))!; Assert.True(await users.CheckPasswordAsync(fresh,"Changed123!"));
        var sessions=new SessionValidation.Handler(db,f.Clock); Assert.False(await sessions.Handle(new(user.Id,oldStamp),default)); Assert.False(await sessions.Handle(new(user.Id,null),default)); Assert.True(await sessions.Handle(new(user.Id,fresh.SecurityStamp),default));
        Assert.Null((await db.SmsChallenges.SingleAsync(x=>x.Id==challenge)).RecoveryHash);
        Assert.Single(await db.SmsMessages.Where(x=>x.Event=="PasswordChanged").ToListAsync());
        var old=await guest.PostAsJsonAsync("/api/account/forgot-password",new{email=user.Email}); Assert.DoesNotContain("resetToken",await old.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Gone,(await guest.PostAsJsonAsync("/api/account/reset-password",new{email=user.Email,token="exposed-old-token",newPassword="Changed456!"})).StatusCode);
    }

    [Fact]
    public async Task Budgets_AreCrossPurpose_CodesExpire_AndWrongAttemptsAreBounded()
    {
        await using var f=await Fixture.Create(); var user=await f.User("Customer","09120000112"); using var guest=f.Host.Client(null);
        var sent=await guest.PostAsJsonAsync("/api/account/otp/request",new{phone=user.PhoneNumber}); Assert.Equal(HttpStatusCode.OK,sent.StatusCode);
        Guid challenge=(await sent.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("challengeId").GetGuid();
        Assert.Equal(HttpStatusCode.TooManyRequests,(await guest.PostAsJsonAsync("/api/account/password/otp/request",new{phone=user.PhoneNumber})).StatusCode);
        for(int i=0;i<5;i++) Assert.Equal(HttpStatusCode.BadRequest,(await guest.PostAsJsonAsync("/api/account/otp/verify",new{challengeId=challenge,code="000000"})).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests,(await guest.PostAsJsonAsync("/api/account/otp/verify",new{challengeId=challenge,code=f.Gateway.Code})).StatusCode);
        for(int i=0;i<4;i++){f.Clock.Advance(TimeSpan.FromSeconds(121));Assert.Equal(HttpStatusCode.OK,(await guest.PostAsJsonAsync("/api/account/otp/request",new{phone=user.PhoneNumber})).StatusCode);}
        f.Clock.Advance(TimeSpan.FromSeconds(121)); Assert.Equal(HttpStatusCode.TooManyRequests,(await guest.PostAsJsonAsync("/api/account/otp/request",new{phone=user.PhoneNumber})).StatusCode);
        f.Clock.Advance(TimeSpan.FromMinutes(31)); sent=await guest.PostAsJsonAsync("/api/account/otp/request",new{phone=user.PhoneNumber}); Assert.Equal(HttpStatusCode.OK,sent.StatusCode);
        challenge=(await sent.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("challengeId").GetGuid(); f.Clock.Advance(TimeSpan.FromMinutes(6));
        Assert.Equal(HttpStatusCode.BadRequest,(await guest.PostAsJsonAsync("/api/account/otp/verify",new{challengeId=challenge,code=f.Gateway.Code})).StatusCode);
    }

    [Fact]
    public async Task UnverifiedLegacyPhone_DoesNotMergeOrTakeOverAnAccount()
    {
        await using var f=await Fixture.Create(); var old=await f.User("Customer","09120000113",verified:false); using var guest=f.Host.Client(null);
        var sent=await guest.PostAsJsonAsync("/api/account/otp/request",new{phone=old.PhoneNumber}); Guid id=(await sent.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("challengeId").GetGuid();
        var proof=await guest.PostAsJsonAsync("/api/account/otp/verify",new{challengeId=id,code=f.Gateway.Code}); Assert.Equal(HttpStatusCode.Conflict,proof.StatusCode);
        Assert.Contains("ACCOUNT_LINK_REQUIRED",await proof.Content.ReadAsStringAsync());
        using var scope=f.Host.App.Services.CreateScope(); var db=scope.ServiceProvider.GetRequiredService<AppDbContext>(); Assert.Equal(1,await db.Users.CountAsync()); Assert.False((await db.Users.SingleAsync()).PhoneNumberConfirmed);
    }

    [Fact]
    public async Task AdminSettings_RejectUninstalledProvidersStaleVersionsAndDuplicateOwnership()
    {
        await using var f=await Fixture.Create(); var user=await f.User("Customer","09120000114");var admin=await f.User("Admin","09120000115");
        using var guest=f.Host.Client(null);using var customer=f.Client(user,"Customer");using var staff=f.Client(admin,"Admin");
        Assert.Equal(HttpStatusCode.Unauthorized,(await guest.GetAsync("/api/admin/store-settings/sms")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await customer.GetAsync("/api/admin/store-settings/sms")).StatusCode);
        var value=(await staff.GetFromJsonAsync<SmsSettingsView>("/api/admin/store-settings/sms"))!;
        Assert.False(value.Providers.Single(x=>x.Id=="Kavenegar").Available);
        Assert.Equal(HttpStatusCode.BadRequest,(await staff.PutAsJsonAsync("/api/admin/store-settings/sms",value with{Provider="Kavenegar"})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await staff.PutAsJsonAsync("/api/admin/store-settings/sms",value with{Recipients=[new(user.Id,["AdminOrderPaid"])]})).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await staff.PutAsJsonAsync("/api/admin/store-settings/sms",value with{Recipients=[new(admin.Id,["AdminOrderPaid"])]})).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await staff.PutAsJsonAsync("/api/admin/store-settings/sms",value)).StatusCode);
        _=await f.User("Customer",user.PhoneNumber!);
        value=(await staff.GetFromJsonAsync<SmsSettingsView>("/api/admin/store-settings/sms"))!; Assert.NotEmpty(value.DuplicateVerifiedPhones);
        Assert.Equal(HttpStatusCode.Conflict,(await staff.PutAsJsonAsync("/api/admin/store-settings/sms",value)).StatusCode);
    }

    [Fact]
    public async Task Tickets_EnforceOwnershipAuthorshipVersionsAndIdempotentNotifications()
    {
        await using var f=await Fixture.Create();var user=await f.User("Customer","09120000116");var other=await f.User("Customer","09120000117");var admin=await f.User("Admin","09120000118");await f.SelectAdmin(admin.Id);
        using var customer=f.Client(user,"Customer");using var stranger=f.Client(other,"Customer");using var staff=f.Client(admin,"Admin");using var guest=f.Host.Client(null);
        var body=new{subject="Ticket fixture",text="Private customer text <script>not executable</script>",isStaff=true};
        var first=await Write(customer,"/api/account/tickets",body,"ticket-fixture"); Assert.Equal(HttpStatusCode.OK,first.StatusCode); Guid id=(await first.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var duplicate=await Write(customer,"/api/account/tickets",body,"ticket-fixture");Assert.Equal(id,(await duplicate.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid());
        Assert.Equal(HttpStatusCode.NotFound,(await stranger.GetAsync($"/api/account/tickets/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,(await guest.GetAsync("/api/admin/tickets")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,(await customer.GetAsync("/api/admin/tickets")).StatusCode);
        var detail=(await staff.GetFromJsonAsync<TicketDetails>($"/api/admin/tickets/{id}"))!;Assert.False(detail.Messages[0].IsStaff);
        var reply=new{version=detail.Ticket.Version,text="Private official reply",isStaff=false};
        Assert.Equal(HttpStatusCode.OK,(await Write(staff,$"/api/admin/tickets/{id}/messages",reply,"reply-fixture")).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await Write(staff,$"/api/admin/tickets/{id}/messages",reply,"reply-fixture")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await Write(staff,$"/api/admin/tickets/{id}/messages",new{version=detail.Ticket.Version,text="Changed"},"reply-fixture")).StatusCode);
        detail=(await customer.GetFromJsonAsync<TicketDetails>($"/api/account/tickets/{id}"))!;Assert.True(detail.Messages[1].IsStaff);Assert.Equal("WaitingForCustomer",detail.Ticket.Status);
        using(var scope=f.Host.App.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Single(await db.SupportTickets.ToListAsync());Assert.Equal(2,await db.SupportTicketMessages.CountAsync());Assert.Single(await db.SmsMessages.Where(x=>x.Event=="AdminTicketNew").ToListAsync());Assert.Single(await db.SmsMessages.Where(x=>x.Event=="TicketReply").ToListAsync());Assert.DoesNotContain("Private",string.Join("",await db.SmsMessages.Select(x=>x.Body).ToListAsync()));}
        var close=await Write(customer,$"/api/account/tickets/{id}/status",new{version=detail.Ticket.Version,close=true},"close-fixture",true);Assert.Equal(HttpStatusCode.OK,close.StatusCode);
        detail=(await customer.GetFromJsonAsync<TicketDetails>($"/api/account/tickets/{id}"))!;
        Assert.Equal(HttpStatusCode.Conflict,(await Write(customer,$"/api/account/tickets/{id}/messages",new{version=detail.Ticket.Version,text="reply while closed"},"closed-reply")).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await Write(customer,$"/api/account/tickets/{id}/status",new{version=detail.Ticket.Version,close=false},"reopen-fixture",true)).StatusCode);
    }

    [Fact]
    public async Task Dispatch_DoesNotResendUnknownAcceptance_AndRetriesOnlyExplicitRejection()
    {
        await using var f=await Fixture.Create();var user=await f.User("Customer","09120000119");using var scope=f.Host.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var row=new SmsMessage{Event="Manual",EventKey="unknown-fixture",UserId=user.Id,Phone=user.PhoneNumber!,Body="Fixture",NextAttemptAtUtc=f.Clock.GetUtcNow().UtcDateTime};db.SmsMessages.Add(row);await db.SaveChangesAsync();
        f.Gateway.Result=new("Unknown",ErrorCode:"SMS_ACCEPTANCE_UNKNOWN");var dispatch=new SmsDispatch(db,[f.Gateway],f.Clock);await dispatch.ProcessAsync(default);await dispatch.ProcessAsync(default);Assert.Equal(1,f.Gateway.TextCalls);Assert.Equal("Unknown",row.Status);
        var retry=new SmsMessage{Event="Manual",EventKey="retry-fixture",UserId=user.Id,Phone=user.PhoneNumber!,Body="Fixture",NextAttemptAtUtc=f.Clock.GetUtcNow().UtcDateTime};db.SmsMessages.Add(retry);await db.SaveChangesAsync();f.Gateway.Result=new("Failed",ErrorCode:"REJECTED",Retryable:true);
        await dispatch.ProcessAsync(default);Assert.Equal("Queued",retry.Status);Assert.Equal(f.Clock.GetUtcNow().UtcDateTime.AddMinutes(1),retry.NextAttemptAtUtc);
        foreach(int minutes in new[]{1,5,15}){f.Clock.Advance(TimeSpan.FromMinutes(minutes));await dispatch.ProcessAsync(default);}
        Assert.Equal(4,retry.Attempts);Assert.Equal("Failed",retry.Status);
        var interrupted=new SmsMessage{Event="Manual",EventKey="interrupted-fixture",UserId=user.Id,Phone=user.PhoneNumber!,Body="Fixture",Status="Sending",LeaseUntilUtc=f.Clock.GetUtcNow().UtcDateTime.AddMinutes(-1)};db.Add(interrupted);await db.SaveChangesAsync();int count=f.Gateway.TextCalls;await dispatch.ProcessAsync(default);Assert.Equal("Unknown",interrupted.Status);Assert.Equal(count,f.Gateway.TextCalls);
    }

    [Fact]
    public async Task ManualMessages_AreQueuedOnce_AndHistoryNeverExposesOtpOrRawDestination()
    {
        await using var f=await Fixture.Create();var admin=await f.User("Admin","09120000120");var user=await f.User("Customer","09120000121");using var staff=f.Client(admin,"Admin");
        var body=new{userId=user.Id,text="Explicit fixture service message"};var first=await Write(staff,"/api/admin/sms/send",body,"manual-fixture");Assert.Equal(HttpStatusCode.OK,first.StatusCode);Guid id=(await first.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        var second=await Write(staff,"/api/admin/sms/send",body,"manual-fixture");Assert.Equal(id,(await second.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid());Assert.Equal(0,f.Gateway.TextCalls);
        using(var scope=f.Host.App.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();await new SmsDispatch(db,[f.Gateway],f.Clock).ProcessAsync(default);Assert.Equal("Accepted",(await db.SmsMessages.FindAsync(id))!.Status);}
        string history=await staff.GetStringAsync("/api/admin/sms/messages");Assert.DoesNotContain(user.PhoneNumber!,history);Assert.DoesNotContain("Explicit fixture",history);Assert.Contains("Accepted",history);
        var unverified=await f.User("Customer","09120000122",verified:false);Assert.Equal(HttpStatusCode.BadRequest,(await Write(staff,"/api/admin/sms/send",new{userId=unverified.Id,text="No"},"unverified-manual")).StatusCode);
    }

    [Fact]
    public async Task LowStock_UsesSilentBaselineAndCooldown_AndPaymentNeedsActualEvidence()
    {
        await using var f=await Fixture.Create();var admin=await f.User("Admin","09120000123");var user=await f.User("Customer","09120000124");await f.SelectAdmin(admin.Id);
        using var scope=f.Host.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var product=new Product{Title="Stock fixture",Slug="stock-fixture",Price=100,StockQuantity=10,Status=ProductStatus.Active};db.Products.Add(product);await db.SaveChangesAsync();
        var dispatch=new SmsDispatch(db,[f.Gateway],f.Clock);await dispatch.LowStockAsync(default);Assert.Empty(await db.SmsMessages.ToListAsync());product.StockQuantity=4;await db.SaveChangesAsync();await dispatch.LowStockAsync(default);await dispatch.LowStockAsync(default);Assert.Single(await db.SmsMessages.Where(x=>x.Event=="AdminLowStock").ToListAsync());
        var order=new Order{UserId=user.Id,OrderNumber="SMS-FIXTURE",ShippingRecipientName="Fixture",Items=[new OrderItem{ProductId=product.Id,ProductTitle=product.Title,Quantity=1,UnitPrice=100}]};order.RecalculateTotals();db.Orders.Add(order);await db.SaveChangesAsync();
        var notifications=new SmsNotifications(db,f.Clock);await notifications.PaidAsync(order,false,default);await db.SaveChangesAsync();Assert.Empty(await db.SmsMessages.Where(x=>x.Event=="OrderPaid").ToListAsync());
        var payment=new PaymentTransaction{OrderId=order.Id,Provider=PaymentProvider.Zarinpal,Authority="fixture-authority",Amount=order.TotalAmount};payment.RecordServerVerification("fixture-reference",f.Clock.GetUtcNow().UtcDateTime,new string('D',64));db.PaymentTransactions.Add(payment);await db.SaveChangesAsync();
        await notifications.PaidAsync(order,false,default);await notifications.PaidAsync(order,false,default);await db.SaveChangesAsync();Assert.Single(await db.SmsMessages.Where(x=>x.Event=="OrderPaid").ToListAsync());Assert.Single(await db.SmsMessages.Where(x=>x.Event=="AdminOrderPaid").ToListAsync());
        var work=new AccountingUnitOfWork(db,f.Clock);await Assert.ThrowsAsync<AccountingException>(()=>work.ExecuteAsync(user.Id,"rolled-back-notification","sms-test",new{},async ct=>{await notifications.CustomerAsync("TicketReply","rollback",user.Id,null,ct);throw new AccountingException("ROLLBACK");},default));
        Assert.Empty(await db.SmsMessages.Where(x=>x.Event=="TicketReply").ToListAsync());
    }

    /// <summary>Executes the actual write routes with stable fixture operation keys.</summary>
    private static Task<HttpResponseMessage> Write(HttpClient client,string url,object payload,string key,bool patch=false)
    {var request=new HttpRequestMessage(patch?HttpMethod.Patch:HttpMethod.Post,url){Content=JsonContent.Create(payload)};request.Headers.Add("Idempotency-Key",key);return client.SendAsync(request);}

    /// <summary>Test-only clock; persisted budgets use it instead of sleeping.</summary>
    private sealed class Clock : TimeProvider
    {private DateTimeOffset _now=DateTimeOffset.UtcNow;public override DateTimeOffset GetUtcNow()=>_now;public void Advance(TimeSpan interval)=>_now+=interval;}
    /// <summary>No HTTP implementation exists in this fixture, making accidental real SMS impossible.</summary>
    private sealed class FakeGateway : ISmsGateway
    {
        public string Id=>"ParsGreen";public bool OtpConfigured=>true;public bool TextConfigured=>true;public bool DeliveryConfigured=>true;public string Code="123456";public int CodeCalls,TextCalls;public SmsGatewayResult Result=new("Accepted","100001");
        public Task<string?> SendCodeAsync(string phone,int otpType,int patternId,CancellationToken ct){CodeCalls++;return Task.FromResult<string?>(Code);}
        public Task<SmsGatewayResult> SendTextAsync(string phone,string text,CancellationToken ct){TextCalls++;return Task.FromResult(Result);}
        public Task<SmsGatewayResult> DeliveryAsync(string id,CancellationToken ct)=>Task.FromResult(new SmsGatewayResult("Delivered",id));
    }
    /// <summary>Isolated migrated SQLite/Identity host with no live credentials, gateways or production access.</summary>
    private sealed class Fixture : IAsyncDisposable
    {
        public ProductArticleTests.ArticleHost Host=null!;public FakeGateway Gateway=new();public Clock Clock=new();
        private string? _databaseFile;
        public static async Task<Fixture> Create(bool fileBacked=false)
        {
            var f=new Fixture();
            if(fileBacked)f._databaseFile=Path.Combine(Path.GetTempPath(),"vendora-sms-fixture-"+Guid.NewGuid().ToString("N")+".db");
            f.Host=await ProductArticleTests.ArticleHost.CreateAsync(services=>{
                if(f._databaseFile is not null){services.RemoveAll<DbContextOptions<AppDbContext>>();services.AddScoped(_=>new DbContextOptionsBuilder<AppDbContext>().UseSqlite("Data Source="+f._databaseFile+";Default Timeout=30;Pooling=False").Options);}
                services.AddDataProtection().UseEphemeralDataProtectionProvider();
                services.AddSingleton<TimeProvider>(f.Clock);services.AddSingleton<ISmsGateway>(f.Gateway);
                services.AddIdentityCore<AppUser>(options=>{options.User.RequireUniqueEmail=true;options.Password.RequireNonAlphanumeric=false;options.Password.RequireUppercase=false;}).AddRoles<IdentityRole<Guid>>().AddEntityFrameworkStores<AppDbContext>().AddDefaultTokenProviders();
                services.RemoveAll<IUserValidator<AppUser>>();services.AddScoped<IUserValidator<AppUser>,VerifiedPhoneUserValidator>();services.AddScoped<IPhoneCodeSender,ConfiguredPhoneCodeSender>();services.AddScoped<AccountingUnitOfWork>();
            });
            using var scope=f.Host.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.SmsSettings.Add(new SmsSettings{PhoneLogin=true,PasswordRecovery=true,ActivatedAtUtc=f.Clock.GetUtcNow().UtcDateTime.AddHours(-1),RulesJson=JsonSerializer.Serialize(SmsPolicy.Templates.Select(x=>new SmsRule(x.Key,true,x.Value)))});await db.SaveChangesAsync();return f;
        }
        public HttpClient Client(AppUser user,string role){var client=Host.Client(role);client.DefaultRequestHeaders.Add("Test-User",user.Id.ToString());return client;}
        public async Task<AppUser> User(string role,string phone,bool password=true,bool verified=true)
        {
            using var scope=Host.App.Services.CreateScope();var users=scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();var roles=scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
            if(!await roles.RoleExistsAsync(role))Assert.True((await roles.CreateAsync(new(role))).Succeeded);
            var user=new AppUser{Id=Guid.NewGuid(),FirstName="Fixture",LastName="User",FullName="Fixture User",Email=Guid.NewGuid()+"@example.invalid",UserName=Guid.NewGuid().ToString("N"),PhoneNumber=phone,PhoneNumberConfirmed=verified};
            var result=password?await users.CreateAsync(user,"Fixture123!"):await users.CreateAsync(user);Assert.True(result.Succeeded,string.Join(",",result.Errors.Select(x=>x.Code)));Assert.True((await users.AddToRoleAsync(user,role)).Succeeded);return user;
        }
        public async Task SelectAdmin(Guid id){using var scope=Host.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var settings=await db.SmsSettings.SingleAsync();settings.RecipientsJson=JsonSerializer.Serialize(new[]{new SmsRecipient(id,SmsPolicy.Templates.Keys.Where(x=>x.StartsWith("Admin")).ToArray())});await db.SaveChangesAsync();}
        public async ValueTask DisposeAsync(){await Host.DisposeAsync();if(_databaseFile is not null){var file=Path.GetFullPath(_databaseFile);if(Path.GetDirectoryName(file)==Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar)&&Path.GetFileName(file).StartsWith("vendora-sms-fixture-"))File.Delete(file);}}
    }
}
