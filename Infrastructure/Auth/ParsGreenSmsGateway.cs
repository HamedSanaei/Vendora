using System.Text;
using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using System.Xml;
using System.Xml.Linq;
using Application.Interfaces;
using Application.Sms;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Auth;

/// <summary>Uses the fixed REST v2 text endpoint and the existing SOAP OTP and delivery contracts.</summary>
public sealed class ParsGreenSmsGateway(HttpClient client, IConfiguration configuration) : ISmsGateway
{
    public string Id => "ParsGreen";
    public bool OtpConfigured => !string.IsNullOrWhiteSpace(configuration["Sms:ParsGreen:Signature"]);
    public bool TextConfigured => OtpConfigured;
    public bool DeliveryConfigured => !string.IsNullOrWhiteSpace(configuration["Sms:ParsGreen:DeliveredCodes"]);
    public bool BrandedOtpConfigured => TextConfigured;
    private static readonly XNamespace Ns = "http://ParsGreen.com/";

    /// <summary>Generates a secure six-digit code, sends the registered white text and exposes it only for server-side hashing after acceptance.</summary>
    public async Task<string?> SendBrandedCodeAsync(string phone, SmsCodePurpose purpose, CancellationToken ct)
    {
        if (!BrandedOtpConfigured || phone.Length != 11 || !phone.StartsWith("09") || !phone.All(char.IsAsciiDigit)) return null;
        string code = RandomNumberGenerator.GetInt32(1_000_000).ToString("D6", CultureInfo.InvariantCulture);
        var result = await SendTextAsync(phone, SmsCodeTemplates.Render(purpose, code), ct);
        return result.Status == "Accepted" ? code : null;
    }

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
        var payload = new Dictionary<string, object> { ["SmsBody"] = text, ["Mobiles"] = new[] { phone } };
        var sender = configuration["Sms:ParsGreen:SenderNumber"];
        if (!string.IsNullOrWhiteSpace(sender)) payload["SmsNumber"] = sender.Trim();

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://sms.parsgreen.ir/Apiv2/Message/SendSms");
        request.Headers.TryAddWithoutValidation("Authorization", "BASIC APIKEY:" + configuration["Sms:ParsGreen:Signature"]!.Trim());
        request.Content = JsonContent.Create(payload);
        try
        {
            using var response = await client.SendAsync(request, ct);
            if (response.StatusCode == HttpStatusCode.TooManyRequests) return new("Failed", ErrorCode: "SMS_RATE_LIMIT", Retryable: true);
            if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden) return new("Failed", ErrorCode: "PARSGREEN_REJECTED");
            if (!response.IsSuccessStatusCode) return new("Unknown", ErrorCode: "SMS_ACCEPTANCE_UNKNOWN");

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var json = await JsonDocument.ParseAsync(stream, cancellationToken: ct);
            var result = json.RootElement;
            if (result.ValueKind == JsonValueKind.Object && result.TryGetProperty("R_Success", out var success))
            {
                if (success.ValueKind == JsonValueKind.False) return new("Failed", ErrorCode: "PARSGREEN_REJECTED");
                if (success.ValueKind == JsonValueKind.True) return new("Accepted", ReadReceipt(result));
            }
            return new("Unknown", ErrorCode: "PARSGREEN_RESPONSE_UNRECOGNIZED");
        }
        catch (Exception error) when (!ct.IsCancellationRequested && error is HttpRequestException or TaskCanceledException or JsonException or IOException)
        {
            return new("Unknown", ErrorCode: "SMS_ACCEPTANCE_UNKNOWN");
        }
    }

    /// <summary>Extracts an optional numeric receipt for the one submitted recipient without retaining provider data.</summary>
    private static string? ReadReceipt(JsonElement result)
    {
        if (!result.TryGetProperty("DataList", out var items) || items.ValueKind != JsonValueKind.Array || items.GetArrayLength() != 1 ||
            items[0].ValueKind != JsonValueKind.Object || !items[0].TryGetProperty("ReqID", out var receipt)) return null;
        var value = receipt.ValueKind switch { JsonValueKind.String => receipt.GetString(), JsonValueKind.Number => receipt.GetRawText(), _ => null };
        return long.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out long id) && id > 0 ? id.ToString(CultureInfo.InvariantCulture) : null;
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
