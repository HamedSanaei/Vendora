using System.Globalization;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.Accounting;
using Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace Infrastructure.Payments;

/// <summary>Implements TabaPay's documented v1 multipart API. Merchant credentials stay in server configuration.</summary>
public sealed class TabaPayGateway(HttpClient client, IConfiguration configuration, IHostEnvironment environment) : ITabaPayGateway
{
    private const string Gateway = "https://api.tabapay.ir";
    private string Merchant => configuration["Payments:TabaPay:Merchant"]?.Trim() ?? "";
    private Uri? CallbackOrigin => ReadOrigin(configuration["Payments:TabaPay:CallbackOrigin"]);
    public Uri? StorefrontOrigin => ReadOrigin(configuration["Payments:TabaPay:StorefrontOrigin"]);
    public bool Sandbox => configuration.GetValue("Payments:TabaPay:Sandbox", environment.IsDevelopment());
    public bool Configured => Guid.TryParseExact(Merchant, "D", out var id) && id != Guid.Empty
        && (!Sandbox || environment.IsDevelopment()) && CallbackOrigin is not null && StorefrontOrigin is not null;

    /// <summary>Creates an unpaid transaction and accepts only the documented payment URL for its token.</summary>
    public async Task<string> CreateAsync(long amountRial, Guid attemptId, string locale, CancellationToken ct)
    {
        if (!Configured) throw new AccountingException("PAYMENT_NOT_CONFIGURED", 503);
        if (locale is not ("fa" or "en")) throw new AccountingException("INVALID_PAYMENT_LOCALE", 400);
        var callback = new Uri(CallbackOrigin!, $"/api/payments/tabapay/callback/{locale}/{attemptId:D}");
        var result = await PostAsync("create", [("amount", Format(amountRial)), ("callbackURL", callback.AbsoluteUri)], ct);
        if (Number(result, "responseCode") == -27)
            throw new AccountingException("PAYMENT_CALLBACK_DOMAIN_MISMATCH", 503);
        if (Number(result, "responseCode") != 1 || Value(result, "status") != "success")
            throw new AccountingException("PAYMENT_GATEWAY_REJECTED", 502);
        string token = Token(result);
        if (!string.Equals(Value(result, "url"), PaymentUrl(token).AbsoluteUri, StringComparison.Ordinal))
            throw new AccountingException("PAYMENT_GATEWAY_INVALID_RESPONSE", 502);
        return token;
    }

    /// <summary>Builds the redirect exclusively from the fixed issuer host and a valid UUID token.</summary>
    public Uri PaymentUrl(string token) => Guid.TryParseExact(token, "D", out var id) && id != Guid.Empty
        ? new Uri(Gateway + (Sandbox ? "/sandbox/pay/" : "/pay/") + token)
        : throw new AccountingException("INVALID_PAYMENT_TOKEN", 400);

    /// <summary>Uses the amount from the order and independently matches the echoed token and gross amount.</summary>
    public async Task<TabaPayEvidence> VerifyAsync(string token, long amountRial, CancellationToken ct)
    {
        if (!Configured) throw new AccountingException("PAYMENT_NOT_CONFIGURED", 503);
        var result = await PostAsync("verify", [("token", token), ("amount", Format(amountRial))], ct);
        string? echoedToken = Value(result, "token");
        long? echoedAmount = Number(result, "amount");
        if ((echoedToken is not null && echoedToken != token) || (echoedAmount.HasValue && echoedAmount != amountRial))
            throw new AccountingException("PAYMENT_VERIFICATION_MISMATCH", 502);

        long? code = Number(result, "responseCode");
        if (echoedToken == token && echoedAmount == amountRial)
        {
            if ((code == 2 || (code == 1 && Value(result, "status") == "success")) && Reference(result) is { } reference)
                return new(token, amountRial, TabaPayDecision.Verified, reference);
            if (code is -100 or -101 or -102 && Value(result, "status") == "error")
                return new(token, amountRial, TabaPayDecision.Failed);
        }
        // An already-verified reply without complete evidence is recovered by the authenticated notification.
        return new(token, amountRial, TabaPayDecision.Pending);
    }

    /// <summary>Authenticates the issuer's POST notification before parsing its payment evidence.</summary>
    public TabaPayEvidence ReadNotification(string? authorize, JsonElement body)
    {
        if (!Configured) throw new AccountingException("PAYMENT_NOT_CONFIGURED", 503);
        // MD5 is mandated by this provider's notification protocol, not used as our audit digest.
        var expected = MD5.HashData(Encoding.ASCII.GetBytes(Merchant));
        if (authorize is null || authorize.Length != 32 || !authorize.All(Uri.IsHexDigit) ||
            !CryptographicOperations.FixedTimeEquals(Convert.FromHexString(authorize), expected))
            throw new AccountingException("PAYMENT_NOTIFICATION_UNAUTHORIZED", 401);
        string token = Token(body);
        long? amount = Number(body, "amount");
        string? reference = Reference(body);
        if (Number(body, "responseCode") != 1 || Value(body, "status") != "success" || amount is null || reference is null)
            throw new AccountingException("INVALID_PAYMENT_NOTIFICATION", 400);
        return new(token, amount.Value, TabaPayDecision.Verified, reference);
    }

    private async Task<JsonElement> PostAsync(string operation, (string Name, string Value)[] fields, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Gateway + (Sandbox ? "/v1/sandbox/" : "/v1/") + operation);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", Merchant);
        using var content = new MultipartFormDataContent();
        foreach (var field in fields) content.Add(new StringContent(field.Value), field.Name);
        request.Content = content;
        try
        {
            using var response = await client.SendAsync(request, ct);
            if ((int)response.StatusCode >= 500 || (int)response.StatusCode is >= 300 and < 400)
                throw new AccountingException("PAYMENT_GATEWAY_UNAVAILABLE", 503);
            var data = await response.Content.ReadAsByteArrayAsync(ct);
            using var json = JsonDocument.Parse(data, new JsonDocumentOptions { MaxDepth = 12 });
            if (json.RootElement.ValueKind != JsonValueKind.Object ||
                (!response.IsSuccessStatusCode && Number(json.RootElement, "responseCode") is not < 0))
                throw new AccountingException("PAYMENT_GATEWAY_INVALID_RESPONSE", 502);
            return json.RootElement.Clone();
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        { throw new AccountingException("PAYMENT_GATEWAY_UNAVAILABLE", 503); }
        catch (HttpRequestException) { throw new AccountingException("PAYMENT_GATEWAY_UNAVAILABLE", 503); }
        catch (JsonException) { throw new AccountingException("PAYMENT_GATEWAY_INVALID_RESPONSE", 502); }
    }

    private Uri? ReadOrigin(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == "https" || (Sandbox && environment.IsDevelopment() && uri.IsLoopback && uri.Scheme == "http"))
        && uri.UserInfo.Length == 0 && uri.AbsolutePath == "/" && uri.Query.Length == 0 && uri.Fragment.Length == 0 ? uri : null;

    private static string Format(long amount) => amount.ToString(CultureInfo.InvariantCulture);
    private static string? Value(JsonElement body, string name) =>
        body.ValueKind == JsonValueKind.Object && body.TryGetProperty(name, out var value)
        ? value.ValueKind switch { JsonValueKind.String => value.GetString(), JsonValueKind.Number => value.GetRawText(), _ => null } : null;
    private static long? Number(JsonElement body, string name) =>
        decimal.TryParse(Value(body, name), NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint,
            CultureInfo.InvariantCulture, out decimal value) && value == decimal.Truncate(value)
        && value is >= long.MinValue and <= long.MaxValue ? (long)value : null;
    private static string Token(JsonElement body) => Value(body, "token") is { } token &&
        Guid.TryParseExact(token, "D", out var id) && id != Guid.Empty ? token : throw new AccountingException("INVALID_PAYMENT_TOKEN", 400);
    private static string? Reference(JsonElement body) => Value(body, "shaparakRefNumber") is { Length: > 0 and <= 100 } reference
        && reference.All(char.IsAsciiDigit) && reference.Any(c => c != '0') ? reference : null;
}
