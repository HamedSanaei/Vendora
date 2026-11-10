using System.Net;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using Application.Interfaces;
using Application.Sms;
using Infrastructure.Auth;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Exercises REST text and SOAP OTP/delivery requests without contacting the carrier.</summary>
public sealed class SmsGatewayTests
{
    /// <summary>Every registered branded pattern receives a secure six-digit code and the same origin-bound suffix.</summary>
    [Theory]
    [InlineData(SmsCodePurpose.Login, "کد ورود شما به وندوراشاپ: ")]
    [InlineData(SmsCodePurpose.Registration, "کد ثبت نام شما در وندوراشاپ: ")]
    [InlineData(SmsCodePurpose.PhoneVerification, "کد تأیید شماره همراه شما در وندوراشاپ: ")]
    [InlineData(SmsCodePurpose.Recovery, "کد بازیابی رمز عبور شما در وندوراشاپ: ")]
    [InlineData(SmsCodePurpose.Test, "کد آزمایشی پیامک وندوراشاپ: ")]
    public async Task BrandedOtp_UsesWhiteTextAndExactPurpose_WithoutFallingBack(SmsCodePurpose purpose, string prefix)
    {
        var wire = new Wire { Json = """{"R_Success":true}""" }; var gateway = Gateway(wire, sender: null);
        string code = (await gateway.SendBrandedCodeAsync("09120000999", purpose, default))!;
        Assert.Matches("^[0-9]{6}$", code);
        using var json = JsonDocument.Parse(wire.Body!);
        Assert.Equal(prefix + code + "\n\n@vendorashop.ir #" + code, json.RootElement.GetProperty("SmsBody").GetString());
        Assert.Equal(prefix + "{code}\n\n@vendorashop.ir #{code}", SmsCodeTemplates.Pattern(purpose));
        Assert.Null(wire.Action);
        Assert.Equal(1, wire.Calls);
        wire.Malformed = true;
        Assert.Null(await gateway.SendBrandedCodeAsync("09120000999", purpose, default));
        Assert.Equal(2, wire.Calls); // Ambiguous acceptance does not retry or fall back to another method.
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(" 300000000000 ")]
    public async Task Text_UsesRestV2AndOmitsEmptySender(string? sender)
    {
        var wire = new Wire();
        var gateway = Gateway(wire, sender: sender);
        Assert.True(gateway.TextConfigured);
        Assert.True(gateway.BrandedOtpConfigured);
        var result = await gateway.SendTextAsync("09120000999", "وندوراشاپ <&>", default);
        Assert.Equal("Accepted", result.Status);
        Assert.Equal("https://sms.parsgreen.ir/Apiv2/Message/SendSms", wire.Url);
        Assert.Equal(HttpMethod.Post, wire.Method);
        Assert.Equal("BASIC APIKEY:fixture-signature", wire.Authorization);
        Assert.Equal("application/json", wire.ContentType);
        using var json = JsonDocument.Parse(wire.Body!);
        Assert.Equal("وندوراشاپ <&>", json.RootElement.GetProperty("SmsBody").GetString());
        Assert.Equal("09120000999", Assert.Single(json.RootElement.GetProperty("Mobiles").EnumerateArray()).GetString());
        Assert.DoesNotContain("fixture-signature", wire.Body);
        if (string.IsNullOrWhiteSpace(sender)) Assert.False(json.RootElement.TryGetProperty("SmsNumber", out _));
        else Assert.Equal(sender.Trim(), json.RootElement.GetProperty("SmsNumber").GetString());
        Assert.Null(await gateway.SendBrandedCodeAsync("09120000999,09120000111", SmsCodePurpose.Login, default));
        Assert.Equal(1, wire.Calls);
        Assert.Throws<ArgumentException>(() => SmsCodeTemplates.Render(SmsCodePurpose.Login, "123456\n@evil.ir #123456"));
    }

    [Fact]
    public void NotificationDefaults_UpgradeOnlyExactLegacyText_AndPreserveCustomRules()
    {
        var at = DateTime.UtcNow.AddDays(-1);
        var rows = new[] { new SmsRule("OrderShipped", true, SmsPolicy.LegacyTemplates["OrderShipped"], at), new SmsRule("PasswordChanged", true, "وندوراشاپ\nرمز عبور حساب شما تغییر کرد. اگر شما نبوده‌اید با پشتیبانی تماس بگیرید.", at), new SmsRule("TicketReply", true, "Custom {link}", at) };
        var result = SmsPolicy.Rules(new Domain.Entities.SmsSettings { RulesJson = System.Text.Json.JsonSerializer.Serialize(rows) });
        Assert.Equal("وندوراشاپ سفارش {orderNumber} ارسال شد. جزئیات و پیگیری: https://vendorashop.ir/fa/order/{orderNumber}", result.Single(x => x.Event == "OrderShipped").Template);
        Assert.Equal(SmsPolicy.Templates["PasswordChanged"], result.Single(x => x.Event == "PasswordChanged").Template);
        Assert.Equal(at, result.Single(x => x.Event == "OrderShipped").EnabledAtUtc);
        Assert.Equal("Custom {link}", result.Single(x => x.Event == "TicketReply").Template);
        Assert.Equal("literal {link}", SmsPolicy.Render("{name}", new Dictionary<string, string> { ["name"] = "literal {link}", ["link"] = "not expanded" }));
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
        Assert.Null(wire.Action);
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
        wire.Throw=false;wire.Json="""{"R_Success":false,"R_Message":"fixture-private-error"}""";
        response=await gateway.SendTextAsync("09120000999","Fixture",default);Assert.Equal("Failed",response.Status);Assert.Equal("PARSGREEN_REJECTED",response.ErrorCode);Assert.False(response.Retryable);
        wire.Json="""{"R_Success":"true"}""";
        response=await gateway.SendTextAsync("09120000999","Fixture",default);Assert.Equal("Unknown",response.Status);Assert.False(response.Retryable);
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
    private static ParsGreenSmsGateway Gateway(Wire wire,string? deliveredCodes=null,string? sender="300000000000")=>new(new HttpClient(wire,false),new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{
        ["Sms:ParsGreen:Signature"]="fixture-signature",["Sms:ParsGreen:SenderNumber"]=sender,["Sms:ParsGreen:DeliveredCodes"]=deliveredCodes}).Build());

    private sealed class Wire : HttpMessageHandler
    {
        public bool Malformed,Throw;public int Calls;public string? Body,Action,Url,Authorization,ContentType;public HttpMethod? Method;public HttpStatusCode Status=HttpStatusCode.OK;
        public string Json = """{"R_Success":true,"DataList":[{"ReqID":123456789}]}""";
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        {
            Calls++;Body=await request.Content!.ReadAsStringAsync(ct);Action=request.Headers.TryGetValues("SOAPAction", out var actions)?actions.Single():null;Url=request.RequestUri!.ToString();
            Authorization=request.Headers.TryGetValues("Authorization", out var auth)?auth.Single():null;ContentType=request.Content.Headers.ContentType?.MediaType;Method=request.Method;
            if(Throw)throw new HttpRequestException("Fixture transport ambiguity");
            if (Action is null) return new(Status) { Content = new StringContent(Malformed ? "{" : Json, Encoding.UTF8, "application/json") };
            string operation=Action.Contains("SendOtp")?"SendOtp":"GetDelivery";
            string fields=operation=="SendOtp"?"<SendOtpResult>1</SendOtpResult><otpCode>123456</otpCode>":"<GetDeliveryResult>7</GetDeliveryResult>";
            string xml=Malformed?"<not-a-provider-result/>":$"<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body><{operation}Response xmlns=\"http://ParsGreen.com/\">{fields}</{operation}Response></soap:Body></soap:Envelope>";
            return new(Status){Content=new StringContent(xml,Encoding.UTF8,"text/xml")};
        }
    }
}
