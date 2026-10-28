using System.Globalization;
using System.Net;
using System.Text.Json;
using Application.Interfaces;
using Infrastructure.Auth;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Tests the published REST wire contract with synthetic keys and in-memory HTTP only; never sends a carrier message.</summary>
public sealed class KavenegarSmsGatewayTests
{
    private const string Phone = "09120000999";
    private const string Key = "synthetic-kavenegar-key";

    /// <summary>Configuration flags expose readiness only and missing prerequisites never contact the provider.</summary>
    [Fact]
    public async Task Configuration_UsesKeyAndApprovedTemplate_AndOptionalDefaultSender()
    {
        var wire = new Wire(); var empty = new KavenegarSmsGateway(new(wire), new ConfigurationBuilder().Build());
        Assert.False(empty.OtpConfigured); Assert.False(empty.TextConfigured); Assert.False(empty.DeliveryConfigured);
        Assert.Null(await empty.SendCodeAsync(Phone, 1, 3, default));
        Assert.Equal("SMS_NOT_CONFIGURED", (await empty.SendTextAsync(Phone, "fixture", default)).ErrorCode);
        Assert.Equal(0, wire.Calls);
        var withoutTemplate = Gateway(wire, template: "");
        Assert.True(withoutTemplate.TextConfigured); Assert.False(withoutTemplate.OtpConfigured);
        Assert.Null(await withoutTemplate.SendCodeAsync(Phone, 1, 3, default));
        Assert.False(Gateway(wire, template:"invalid_template").OtpConfigured);
        Assert.False(Gateway(wire, sender:"+").TextConfigured);
        Assert.False(Gateway(wire, sender:"3000,3001").TextConfigured);
    }

    /// <summary>POST bodies encode Persian content and phone numbers; neither goes into query strings.</summary>
    [Theory]
    [InlineData("")]
    [InlineData("1000123456")]
    public async Task ServiceSend_PostsEncodedFieldsAndReturnsReceipt(string sender)
    {
        var wire = new Wire(); var result = await Gateway(wire, sender:sender).SendTextAsync(Phone, "پیام خدماتی & تست +", default);
        Assert.Equal("Accepted", result.Status); Assert.Equal("123456789012", result.ProviderId); Assert.False(result.Retryable);
        Assert.Equal(HttpMethod.Post, wire.Method); Assert.Equal("https", wire.Url!.Scheme); Assert.Equal("api.kavenegar.com", wire.Url.Host);
        Assert.Equal($"/v1/{Key}/sms/send.json", wire.Url.AbsolutePath); Assert.Equal("", wire.Url.Query);
        Assert.Equal(Phone, wire.Fields["receptor"]); Assert.Equal("پیام خدماتی & تست +", wire.Fields["message"]);
        Assert.Equal("application/x-www-form-urlencoded", wire.ContentType);
        Assert.Equal(sender.Length > 0, wire.Fields.ContainsKey("sender"));
        if (sender.Length > 0) Assert.Equal(sender, wire.Fields["sender"]);
    }

    /// <summary>The six-digit lookup token returned for local hashing is exactly what the provider received, never a vendor-generated secret.</summary>
    [Fact]
    public async Task Lookup_GeneratesCryptographicNumericToken_AndRequiresPositiveAcceptance()
    {
        var wire = new Wire(); var gateway = Gateway(wire);
        string? code = await gateway.SendCodeAsync(Phone, 99, 99, default);
        Assert.Matches("^[0-9]{6}$", code!); Assert.Equal(code, wire.Fields["token"]);
        Assert.EndsWith("/verify/lookup.json", wire.Url!.AbsolutePath);
        Assert.Equal("vendoraVerify", wire.Fields["template"]); Assert.Equal("sms", wire.Fields["type"]);
        Assert.False(wire.Fields.ContainsKey("patternId")); Assert.False(wire.Fields.ContainsKey("sender"));
        wire.Body = Envelope(200, 14); Assert.Null(await gateway.SendCodeAsync(Phone, 1, 3, default));
        wire.Body = "{\"return\":{\"status\":424,\"message\":\"not approved\"},\"entries\":null}";
        Assert.Null(await gateway.SendCodeAsync(Phone, 1, 3, default));
    }

    /// <summary>Only documented status ten asserts delivery; failed delivery is never retried as a fresh send.</summary>
    [Theory]
    [InlineData(1,"Accepted")][InlineData(2,"Accepted")][InlineData(4,"Accepted")][InlineData(5,"Accepted")]
    [InlineData(10,"Delivered")][InlineData(6,"Failed")][InlineData(11,"Failed")][InlineData(13,"Failed")][InlineData(14,"Failed")]
    [InlineData(100,"Unknown")][InlineData(999,"Unknown")]
    public async Task Delivery_MapsDocumentedStatusesWithoutResending(int code, string expected)
    {
        var wire = new Wire { Body = Envelope(200, code) };
        var result = await Gateway(wire).DeliveryAsync("123456789012", default);
        Assert.Equal(expected, result.Status); Assert.False(result.Retryable);
        Assert.EndsWith("/sms/status.json", wire.Url!.AbsolutePath); Assert.Equal("123456789012", wire.Fields["messageid"]);
        Assert.False(wire.Fields.ContainsKey("message")); Assert.Equal(1,wire.Calls);
    }

    /// <summary>Explicit rejected requests report safe numeric codes only; only documented throttling/unavailability can retry.</summary>
    [Theory]
    [InlineData(403,false)][InlineData(418,false)][InlineData(424,false)][InlineData(409,true)][InlineData(429,true)][InlineData(451,true)]
    public async Task Rejections_DoNotLeakMessages(int code, bool retry)
    {
        var wire = new Wire { Body = $"{{\"return\":{{\"status\":{code},\"message\":\"private-phone-otp-key\"}},\"entries\":null}}" };
        var result = await Gateway(wire).SendTextAsync(Phone,"private body",default);
        Assert.Equal("Failed",result.Status); Assert.Equal(retry,result.Retryable);
        Assert.Equal("KAVENEGAR_ERROR_"+code,result.ErrorCode); Assert.Null(result.ProviderId);
        Assert.DoesNotContain("private",JsonSerializer.Serialize(result));
    }

    /// <summary>Timeout, malformed, oversized, contradictory, multi-entry and mismatched responses cannot cause blind retries.</summary>
    [Fact]
    public async Task Ambiguity_StaysUnknownAndNonRetryable()
    {
        var wire = new Wire(); var gateway = Gateway(wire);
        foreach (string body in new[] { "not-json", "{}", "[]", "{\"return\":{\"status\":200},\"entries\":[]}",
            Envelope(200,1).Replace("123456789012","0"), Envelope(200,1).Replace(Phone,"09120000000"),
            Envelope(200,1).Replace("\"status\":200","\"status\":\"200\""), new string('x',32769) })
        {
            wire.Body=body; var result=await gateway.SendTextAsync(Phone,"fixture",default);
            Assert.Equal("Unknown",result.Status); Assert.False(result.Retryable);
        }
        wire.Body=Envelope(200,1); wire.Status=HttpStatusCode.InternalServerError;
        Assert.Equal("Unknown",(await gateway.SendTextAsync(Phone,"fixture",default)).Status);
        wire.Status=HttpStatusCode.OK; wire.Throw=true;
        Assert.Equal("Unknown",(await gateway.SendTextAsync(Phone,"fixture",default)).Status);
        wire.Throw=false; wire.Timeout=true;
        Assert.Null(await gateway.SendCodeAsync(Phone,1,3,default));
    }

    /// <summary>Invalid IDs, multiple recipients and overlong service bodies fail before HTTP I/O.</summary>
    [Fact]
    public async Task InvalidInput_AndCallerCancellation_AreBounded()
    {
        var wire=new Wire();var gateway=Gateway(wire);
        Assert.Equal("Failed",(await gateway.SendTextAsync(Phone,new string('x',1801),default)).Status);
        Assert.Equal("Failed",(await gateway.SendTextAsync(Phone+","+Phone,"fixture",default)).Status);
        Assert.Equal("Unknown",(await gateway.DeliveryAsync("1&messageid=2",default)).Status); Assert.Equal(0,wire.Calls);
        Assert.Equal("Accepted",(await gateway.SendTextAsync(Phone,new string('x',1800),default)).Status);
        using var cancelled=new CancellationTokenSource();cancelled.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(()=>gateway.SendCodeAsync(Phone,1,3,cancelled.Token));
    }

    /// <summary>Both adapters register together and the Kavenegar URI-based API key never reaches default HttpClient logs.</summary>
    [Fact]
    public async Task Registration_InstallsBothProviders_AndSuppressesCredentialUrlLogging()
    {
        var wire=new Wire();var logs=new Logs();var services=new ServiceCollection();
        services.AddSingleton<IConfiguration>(Configuration());services.AddLogging(x=>x.SetMinimumLevel(LogLevel.Trace).AddProvider(logs));
        Infrastructure.DependencyInjection.AddInfrastructure(services);
        services.AddHttpClient("SmsKavenegar").ConfigurePrimaryHttpMessageHandler(()=>wire);
        using var provider=services.BuildServiceProvider();
        var gateways=provider.GetServices<ISmsGateway>().ToList();Assert.Equal(2,gateways.Count);
        Assert.Contains(gateways,x=>x.Id=="ParsGreen");var gateway=Assert.Single(gateways,x=>x.Id=="Kavenegar");
        Assert.Equal("Accepted",(await gateway.SendTextAsync(Phone,"private body",default)).Status);Assert.Equal(1,wire.Calls);
        Assert.DoesNotContain(logs.Messages,x=>x.Contains(Key)||x.Contains(Phone)||x.Contains("private body")||x.Contains("/sms/send"));
    }

    /// <summary>Builds a synthetic single-recipient provider response without real credentials or customer data.</summary>
    private static string Envelope(int result, int state) => JsonSerializer.Serialize(new { @return=new { status=result }, entries=new[] { new { messageid=123456789012L,status=state,receptor=Phone } } });
    /// <summary>Creates in-memory secret configuration; these are never operator credentials.</summary>
    private static IConfiguration Configuration(string template="vendoraVerify",string sender="") => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
        ["Sms:Kavenegar:ApiKey"]=Key,["Sms:Kavenegar:OtpTemplate"]=template,["Sms:Kavenegar:SenderNumber"]=sender }).Build();
    /// <summary>Creates the real adapter with an in-memory wire.</summary>
    private static KavenegarSmsGateway Gateway(Wire wire,string template="vendoraVerify",string sender="") => new(new HttpClient(wire,false),Configuration(template,sender));

    private sealed class Wire : HttpMessageHandler
    {
        public string Body=Envelope(200,1);public HttpStatusCode Status=HttpStatusCode.OK;public int Calls;public bool Throw,Timeout;
        public Uri? Url;public HttpMethod? Method;public string? ContentType;public Dictionary<string,string> Fields=[];
        /// <summary>Records a local request and returns a fixture; never opens a network connection.</summary>
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        {
            ct.ThrowIfCancellationRequested();Calls++;Url=request.RequestUri;Method=request.Method;ContentType=request.Content?.Headers.ContentType?.MediaType;
            Fields=(await request.Content!.ReadAsStringAsync(ct)).Split('&').Select(x=>x.Split('=',2)).ToDictionary(x=>x[0],x=>Uri.UnescapeDataString(x[1].Replace('+',' ')));
            if(Throw)throw new HttpRequestException("Synthetic transport failure");if(Timeout)throw new TaskCanceledException();
            return new(Status){Content=new StringContent(Body)};
        }
    }
    private sealed class Logs : ILoggerProvider,ILogger
    {
        public List<string> Messages=[];
        public ILogger CreateLogger(string categoryName)=>this;
        public void Dispose() { }
        public IDisposable? BeginScope<TState>(TState state) where TState:notnull=>null;
        public bool IsEnabled(LogLevel level)=>true;
        public void Log<TState>(LogLevel level,EventId id,TState state,Exception? error,Func<TState,Exception?,string> formatter)=>Messages.Add(formatter(state,error));
    }
}
