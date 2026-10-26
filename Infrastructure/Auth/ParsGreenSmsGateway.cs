using System.Text;
using System.Xml;
using System.Xml.Linq;
using Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Auth;

/// <summary>Fixed-host SOAP adapter based on the official WSDL. Never logs bodies, numbers, signatures or OTPs.</summary>
public sealed class ParsGreenSmsGateway(HttpClient client, IConfiguration configuration) : ISmsGateway
{
    public string Id => "ParsGreen";
    public bool OtpConfigured => !string.IsNullOrWhiteSpace(configuration["Sms:ParsGreen:Signature"]);
    public bool TextConfigured => OtpConfigured && !string.IsNullOrWhiteSpace(configuration["Sms:ParsGreen:SenderNumber"]);
    public bool DeliveryConfigured => !string.IsNullOrWhiteSpace(configuration["Sms:ParsGreen:DeliveredCodes"]);
    private static readonly XNamespace Ns = "http://ParsGreen.com/";

    /// <inheritdoc />
    public async Task<string?> SendCodeAsync(string phone, int otpType, int patternId, CancellationToken ct)
    {
        if (!OtpConfigured) return null;
        XDocument? xml;
        try { xml = await CallAsync("SendOtp", [new(Ns + "mobile", phone), new(Ns + "Lang", "fa"), new(Ns + "otpType", otpType), new(Ns + "patternId", patternId)], ct); }
        catch (ProviderThrottledException) { return null; }
        string? code = xml?.Descendants(Ns + "otpCode").SingleOrDefault()?.Value.Trim();
        return xml?.Descendants(Ns + "SendOtpResult").SingleOrDefault()?.Value == "1" && code is { Length: >= 4 and <= 8 } && code.All(char.IsAsciiDigit) ? code : null;
    }

    /// <inheritdoc />
    public async Task<SmsGatewayResult> SendTextAsync(string phone, string text, CancellationToken ct)
    {
        if (!TextConfigured) return new("Failed", ErrorCode: "SMS_NOT_CONFIGURED");
        XDocument? xml;
        try { xml = await CallAsync("SendGroupSMS", [new(Ns + "from", configuration["Sms:ParsGreen:SenderNumber"]), new(Ns + "to", new XElement(Ns + "string", phone)),
            new(Ns + "text", text), new(Ns + "isFlash", false), new(Ns + "udh", ""), new(Ns + "success", 0), new(Ns + "retStr")], ct); }
        catch (ProviderThrottledException) { return new("Failed", ErrorCode: "SMS_RATE_LIMIT", Retryable: true); }
        if (xml is null) return new("Unknown", ErrorCode: "SMS_ACCEPTANCE_UNKNOWN");
        var success = xml.Descendants(Ns + "success").SingleOrDefault()?.Value;
        var receipt = xml.Descendants(Ns + "retStr").Elements(Ns + "string").SingleOrDefault()?.Value.Trim();
        if (success == "1" && long.TryParse(receipt, out long id) && id > 0) return new("Accepted", receipt);
        // A well-formed negative provider result is a rejection; unknown responses are never retried blindly.
        return int.TryParse(xml.Descendants(Ns + "SendGroupSMSResult").SingleOrDefault()?.Value, out int result) && result < 0
            ? new("Failed", ErrorCode: "PARSGREEN_REJECTED") : new("Unknown", ErrorCode: "PARSGREEN_RESPONSE_UNRECOGNIZED");
    }

    /// <inheritdoc />
    public async Task<SmsGatewayResult> DeliveryAsync(string providerId, CancellationToken ct)
    {
        if (!OtpConfigured || !long.TryParse(providerId, out long id) || id <= 0) return new("Unknown", ErrorCode: "DELIVERY_UNAVAILABLE");
        XDocument? xml;
        try { xml = await CallAsync("GetDelivery", [new(Ns + "recId", providerId)], ct); }
        catch (ProviderThrottledException) { return new("Accepted", providerId, "DELIVERY_RATE_LIMIT"); }
        string? code = xml?.Descendants(Ns + "GetDeliveryResult").SingleOrDefault()?.Value;
        // The public WSDL specifies an int, not its operator-specific meanings. Only explicitly configured, documented codes may assert delivery.
        string[] Codes(string key) => (configuration["Sms:ParsGreen:" + key] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (code is not null && Codes("DeliveredCodes").Contains(code)) return new("Delivered", providerId);
        if (code is not null && Codes("FailedDeliveryCodes").Contains(code)) return new("Failed", providerId, "DELIVERY_FAILED");
        return new("Accepted", providerId, "DELIVERY_PENDING_OR_UNMAPPED");
    }

    /// <summary>Posts a bounded SOAP envelope. Transport ambiguity is returned without exposing vendor errors.</summary>
    private async Task<XDocument?> CallAsync(string method, XElement[] fields, CancellationToken ct)
    {
        XNamespace soap = "http://schemas.xmlsoap.org/soap/envelope/";
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://login.parsgreen.com/Api/SendSMS.asmx");
        request.Headers.Add("SOAPAction", $"\"http://ParsGreen.com/{method}\"");
        request.Content = new StringContent(new XElement(soap + "Envelope", new XElement(soap + "Body", new XElement(Ns + method,
            new XElement(Ns + "signature", configuration["Sms:ParsGreen:Signature"]), fields))).ToString(SaveOptions.DisableFormatting), Encoding.UTF8, "text/xml");
        try
        {
            using var response = await client.SendAsync(request, ct);
            if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests) throw new ProviderThrottledException();
            if (!response.IsSuccessStatusCode) return null;
            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var reader = XmlReader.Create(stream, new XmlReaderSettings { Async = true, DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 32768 });
            return await XDocument.LoadAsync(reader, LoadOptions.None, ct);
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or XmlException or InvalidOperationException) { return null; }
    }
    private sealed class ProviderThrottledException : Exception;
}
