using System.Text;
using System.Xml;
using System.Xml.Linq;
using Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Auth;

/// <summary>Calls the published ParsGreen SOAP SendOtp contract over TLS without a new SDK dependency.</summary>
public sealed class ParsGreenPhoneCodeSender(HttpClient client, IConfiguration settings) : IPhoneCodeSender
{
    public bool IsConfigured => !string.IsNullOrWhiteSpace(settings["Sms:ParsGreen:Signature"]);

    /// <inheritdoc />
    public async Task<string?> SendAsync(string phone, CancellationToken ct)
    {
        if (!IsConfigured) return null;
        XNamespace soap = "http://schemas.xmlsoap.org/soap/envelope/", ns = "http://ParsGreen.com/";
        var envelope = new XElement(soap + "Envelope", new XElement(soap + "Body", new XElement(ns + "SendOtp",
            new XElement(ns + "signature", settings["Sms:ParsGreen:Signature"]), new XElement(ns + "mobile", phone),
            new XElement(ns + "Lang", "fa"), new XElement(ns + "otpType", 1), new XElement(ns + "patternId", 3))));
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://login.parsgreen.com/Api/SendSMS.asmx");
        request.Headers.Add("SOAPAction", "\"http://ParsGreen.com/SendOtp\"");
        request.Content = new StringContent(envelope.ToString(SaveOptions.DisableFormatting), Encoding.UTF8, "text/xml");
        try
        {
            using var response = await client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode) return null;
            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var reader = XmlReader.Create(stream, new XmlReaderSettings { Async = true, DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 32768 });
            var xml = await XDocument.LoadAsync(reader, LoadOptions.None, ct);
            string? code = xml.Descendants(ns + "otpCode").SingleOrDefault()?.Value.Trim();
            return xml.Descendants(ns + "SendOtpResult").SingleOrDefault()?.Value == "1"
                && code is { Length: >= 4 and <= 8 } && code.All(char.IsAsciiDigit) ? code : null;
        }
        catch (Exception error) when (error is HttpRequestException or TaskCanceledException or XmlException or InvalidOperationException)
        { return null; } // Never log signature, destination, provider response, or OTP.
    }
}
