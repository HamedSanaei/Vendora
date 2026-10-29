using System.Net;
using System.Text;
using System.Xml.Linq;
using Application.Interfaces;
using Application.Sms;
using Infrastructure.Auth;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Official SOAP wire-shape fixtures only; the message handler cannot reach a live SMS provider.</summary>
public sealed class SmsGatewayTests
{
    /// <summary>Every registered branded pattern receives a secure six-digit code and the same origin-bound suffix.</summary>
    [Theory]
    [InlineData(SmsCodePurpose.Login)]
    [InlineData(SmsCodePurpose.Registration)]
    [InlineData(SmsCodePurpose.PhoneVerification)]
    [InlineData(SmsCodePurpose.Recovery)]
    [InlineData(SmsCodePurpose.Test)]
    public async Task BrandedOtp_UsesWhiteTextAndExactPurpose_WithoutFallingBack(SmsCodePurpose purpose)
    {
        var wire = new Wire(); var gateway = Gateway(wire);
        string code = (await gateway.SendBrandedCodeAsync("09120000999", purpose, default))!;
        Assert.Matches("^[0-9]{6}$", code);
        XNamespace ns = "http://ParsGreen.com/";
        string text = XDocument.Parse(wire.Body!).Descendants(ns + "text").Single().Value;
        Assert.Equal(SmsCodeTemplates.Render(purpose, code), text);
        Assert.EndsWith("\n\n@vendorashop.ir #" + code, text);
        Assert.Contains("SendGroupSMS", wire.Action); Assert.DoesNotContain("SendOtp", wire.Action);
        Assert.Equal(1, wire.Calls);
        wire.Malformed = true;
        Assert.Null(await gateway.SendBrandedCodeAsync("09120000999", purpose, default));
        Assert.Equal(2, wire.Calls); // Ambiguous acceptance does not retry or fall back to another method.
    }

    [Fact]
    public async Task BrandedOtp_RequiresSenderAndValidPhone_WhileLegacyModeRemainsAvailable()
    {
        var wire = new Wire();
        var gateway = new ParsGreenSmsGateway(new HttpClient(wire), new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> { ["Sms:ParsGreen:Signature"] = "fixture-signature" }).Build());
        Assert.True(gateway.OtpConfigured); Assert.False(gateway.BrandedOtpConfigured);
        Assert.Null(await gateway.SendBrandedCodeAsync("09120000999", SmsCodePurpose.Login, default));
        Assert.Equal(0, wire.Calls);
        Assert.NotNull(await gateway.SendCodeAsync("09120000999", 1, 3, default));
        Assert.Null(await Gateway(wire).SendBrandedCodeAsync("09120000999,09120000111", SmsCodePurpose.Login, default));
        Assert.Equal(1, wire.Calls);
        Assert.Throws<ArgumentException>(() => SmsCodeTemplates.Render(SmsCodePurpose.Login, "123456\n@evil.ir #123456"));
    }

    [Fact]
    public void NotificationDefaults_UpgradeOnlyExactLegacyText_AndPreserveCustomRules()
    {
        var at = DateTime.UtcNow.AddDays(-1);
        var rows = new[] { new SmsRule("OrderShipped", true, SmsPolicy.LegacyTemplates["OrderShipped"], at), new SmsRule("TicketReply", true, "Custom {link}", at) };
        var result = SmsPolicy.Rules(new Domain.Entities.SmsSettings { RulesJson = System.Text.Json.JsonSerializer.Serialize(rows) });
        Assert.Equal("وندوراشاپ\nسفارش {orderNumber} ارسال شد. جزئیات و پیگیری: {link}", result.Single(x => x.Event == "OrderShipped").Template);
        Assert.Equal(at, result.Single(x => x.Event == "OrderShipped").EnabledAtUtc);
        Assert.Equal("Custom {link}", result.Single(x => x.Event == "TicketReply").Template);
        Assert.All(SmsPolicy.Templates.Values, text => Assert.StartsWith("وندوراشاپ\n", text));
    }
    [Fact]
    public async Task Otp_UsesServerSignatureAndConfiguredPattern_WithoutReturningItFromAnHttpApi()
    {
        var wire=new Wire();var gateway=Gateway(wire);
        Assert.Equal("123456",await gateway.SendCodeAsync("09120000999",1,3,default));
        Assert.Equal("https://login.parsgreen.com/Api/SendSMS.asmx",wire.Url);
        var body=XDocument.Parse(wire.Body!);XNamespace ns="http://ParsGreen.com/";
        Assert.Equal("fixture-signature",body.Descendants(ns+"signature").Single().Value);
        Assert.Equal("3",body.Descendants(ns+"patternId").Single().Value);Assert.Equal("1",body.Descendants(ns+"otpType").Single().Value);
        wire.Malformed=true;Assert.Null(await gateway.SendCodeAsync("09120000999",1,3,default));
    }

    [Fact]
    public async Task Accepted_IsNotDelivered_AndOnlyAnExplicitStatusMappingCanAssertDelivery()
    {
        var wire=new Wire();var gateway=Gateway(wire);
        var result=await gateway.SendTextAsync("09120000999","Plain <&> fixture",default);
        Assert.Equal("Accepted",result.Status);Assert.Equal("123456789",result.ProviderId);
        Assert.Contains("&lt;&amp;&gt;",wire.Body);Assert.Contains("SendGroupSMS",wire.Action);
        Assert.Equal("Accepted",(await gateway.DeliveryAsync(result.ProviderId!,default)).Status);
        // 7 is a synthetic fixture code, not a claim about a real ParsGreen delivery-code meaning.
        Assert.Equal("Delivered",(await Gateway(wire,"7").DeliveryAsync(result.ProviderId!,default)).Status);
    }

    [Fact]
    public async Task AmbiguousTransportOrPayload_IsNeverMarkedSafeToResend()
    {
        var wire=new Wire{Malformed=true};var gateway=Gateway(wire);
        var response=await gateway.SendTextAsync("09120000999","Fixture",default);Assert.Equal("Unknown",response.Status);Assert.False(response.Retryable);
        wire.Malformed=false;wire.Throw=true;response=await gateway.SendTextAsync("09120000999","Fixture",default);Assert.Equal("Unknown",response.Status);Assert.False(response.Retryable);
        wire.Throw=false;wire.Status=HttpStatusCode.TooManyRequests;response=await gateway.SendTextAsync("09120000999","Fixture",default);Assert.Equal("Failed",response.Status);Assert.True(response.Retryable);
        Assert.Null(await gateway.SendCodeAsync("09120000999",1,3,default));
    }

    [Fact]
    public async Task MissingConfiguration_DoesNotMakeAnExternalRequest()
    {
        var wire=new Wire();var gateway=new ParsGreenSmsGateway(new HttpClient(wire),new ConfigurationBuilder().Build());
        Assert.False(gateway.OtpConfigured);Assert.False(gateway.TextConfigured);
        Assert.Null(await gateway.SendCodeAsync("09120000999",1,3,default));Assert.Equal("Failed",(await gateway.SendTextAsync("09120000999","Fixture",default)).Status);Assert.Equal(0,wire.Calls);
    }

    /// <summary>Creates a provider with in-memory nonproduction credentials and an optional explicitly supplied code mapping.</summary>
    private static ParsGreenSmsGateway Gateway(Wire wire,string? deliveredCodes=null)=>new(new HttpClient(wire,false),new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{
        ["Sms:ParsGreen:Signature"]="fixture-signature",["Sms:ParsGreen:SenderNumber"]="300000000000",["Sms:ParsGreen:DeliveredCodes"]=deliveredCodes}).Build());

    private sealed class Wire : HttpMessageHandler
    {
        public bool Malformed,Throw;public int Calls;public string? Body,Action,Url;public HttpStatusCode Status=HttpStatusCode.OK;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        {
            Calls++;Body=await request.Content!.ReadAsStringAsync(ct);Action=request.Headers.GetValues("SOAPAction").Single();Url=request.RequestUri!.ToString();
            if(Throw)throw new HttpRequestException("Fixture transport ambiguity");
            string operation=Action.Contains("SendOtp")?"SendOtp":Action.Contains("SendGroupSMS")?"SendGroupSMS":"GetDelivery";
            string fields=operation=="SendOtp"?"<SendOtpResult>1</SendOtpResult><otpCode>123456</otpCode>":operation=="SendGroupSMS"?"<SendGroupSMSResult>1</SendGroupSMSResult><success>1</success><retStr><string>123456789</string></retStr>":"<GetDeliveryResult>7</GetDeliveryResult>";
            string xml=Malformed?"<not-a-provider-result/>":$"<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body><{operation}Response xmlns=\"http://ParsGreen.com/\">{fields}</{operation}Response></soap:Body></soap:Envelope>";
            return new(Status){Content=new StringContent(xml,Encoding.UTF8,"text/xml")};
        }
    }
}
