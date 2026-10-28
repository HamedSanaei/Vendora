using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text.Json;
using Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Auth;

/// <summary>Fixed-host Kavenegar REST adapter. Credentials, OTPs and raw vendor responses never escape this boundary.</summary>
public sealed class KavenegarSmsGateway(HttpClient client, IConfiguration configuration) : ISmsGateway
{
    public string Id => "Kavenegar";
    public int MaxTextLength => 1800;
    private string ApiKey => configuration["Sms:Kavenegar:ApiKey"]?.Trim() ?? "";
    private string Template => configuration["Sms:Kavenegar:OtpTemplate"]?.Trim() ?? "";
    private string Sender => configuration["Sms:Kavenegar:SenderNumber"]?.Trim() ?? "";
    private bool HasKey => ApiKey.Length is > 0 and <= 512 && !ApiKey.Any(char.IsControl);
    public bool OtpConfigured => HasKey && Template.Length is > 0 and <= 100 && Template.All(c => char.IsAsciiLetterOrDigit(c) || c == '-');
    public bool TextConfigured => HasKey && (Sender.Length == 0 || Sender.Length <= 30 && Sender.TrimStart('+').Length > 0 && Sender.IndexOf('+', 1) < 0 && Sender.TrimStart('+').All(char.IsAsciiDigit));
    public bool DeliveryConfigured => HasKey;

    /// <summary>Generates a six-digit cryptographic code and returns it for hashing only after positive provider acceptance.</summary>
    public async Task<string?> SendCodeAsync(string phone, int otpType, int patternId, CancellationToken ct)
    {
        // ParsGreen's numeric otpType/patternId have no meaning in Kavenegar; its approved template is server configuration.
        if (!OtpConfigured || !ValidPhone(phone)) return null;
        string code = RandomNumberGenerator.GetInt32(1_000_000).ToString("D6", CultureInfo.InvariantCulture);
        var response = await CallAsync("verify/lookup", new() { ["receptor"] = phone, ["token"] = code, ["template"] = Template, ["type"] = "sms" }, ct);
        var result = SendResult(response, phone);
        return result.Status is "Accepted" or "Delivered" ? code : null;
    }

    /// <summary>Posts a single recipient's service message; an omitted sender uses the account's provider-side default.</summary>
    public async Task<SmsGatewayResult> SendTextAsync(string phone, string text, CancellationToken ct)
    {
        if (!TextConfigured) return new("Failed", ErrorCode: "SMS_NOT_CONFIGURED");
        if (!ValidPhone(phone)) return new("Failed", ErrorCode: "SMS_INVALID_RECIPIENT");
        if (string.IsNullOrWhiteSpace(text) || text.Length > MaxTextLength) return new("Failed", ErrorCode: "SMS_INVALID_TEXT");
        var fields = new Dictionary<string, string> { ["receptor"] = phone, ["message"] = text };
        if (Sender.Length > 0) fields["sender"] = Sender;
        return SendResult(await CallAsync("sms/send", fields, ct), phone);
    }

    /// <summary>Polls only the stored message ID. Failure to read delivery never authorizes sending the message again.</summary>
    public async Task<SmsGatewayResult> DeliveryAsync(string providerId, CancellationToken ct)
    {
        if (!DeliveryConfigured || !long.TryParse(providerId, NumberStyles.None, CultureInfo.InvariantCulture, out long id) || id <= 0)
            return new("Unknown", ErrorCode: "DELIVERY_UNAVAILABLE");
        var response = await CallAsync("sms/status", new() { ["messageid"] = providerId }, ct);
        if (response.Code != 200 || !response.HttpSuccess || response.Entry is not { } entry || entry.Id != id)
            return new("Accepted", providerId, "KAVENEGAR_DELIVERY_UNAVAILABLE");
        return MessageState(entry.State, providerId);
    }

    /// <summary>Requires one matching positive receipt; unrecognized, contradictory and interrupted responses remain non-retryable unknowns.</summary>
    private static SmsGatewayResult SendResult(Reply response, string phone)
    {
        if (response.Code is >= 400 and < 500 && !response.HttpServerError)
            return new("Failed", ErrorCode: "KAVENEGAR_ERROR_" + response.Code, Retryable: response.Code is 409 or 429 or 451);
        if (response.Code == 200 && response.HttpSuccess && response.Entry is { } entry && entry.Id > 0 && SamePhone(entry.Phone, phone))
            return MessageState(entry.State, entry.Id.ToString(CultureInfo.InvariantCulture));
        return new("Unknown", ErrorCode: "SMS_ACCEPTANCE_UNKNOWN");
    }

    /// <summary>Maps documented delivery codes without conflating acceptance with handset delivery or retrying a failed delivery.</summary>
    private static SmsGatewayResult MessageState(int state, string id) => state switch
    {
        1 or 2 or 4 or 5 => new("Accepted", id),
        10 => new("Delivered", id),
        6 or 11 or 13 or 14 => new("Failed", id, "KAVENEGAR_DELIVERY_" + state),
        _ => new("Unknown", id, "KAVENEGAR_STATUS_UNKNOWN")
    };

    /// <summary>Allows one normalized Iranian mobile only, preventing accidental multi-recipient requests.</summary>
    private static bool ValidPhone(string phone) => phone.Length == 11 && phone.StartsWith("09", StringComparison.Ordinal) && phone.All(char.IsAsciiDigit);

    /// <summary>Matches the optional international representation returned by the provider to the requested local phone.</summary>
    private static bool SamePhone(string? returned, string expected) => returned == expected || returned == "+98" + expected[1..] || returned == "0098" + expected[1..];

    /// <summary>Posts encoded parameters to the fixed TLS endpoint and parses at most 32KB, ignoring raw messages and exception details.</summary>
    private async Task<Reply> CallAsync(string method, Dictionary<string, string> fields, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"https://api.kavenegar.com/v1/{Uri.EscapeDataString(ApiKey)}/{method}.json")
        { Content = new FormUrlEncodedContent(fields) };
        try
        {
            using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
            if (response.StatusCode == HttpStatusCode.TooManyRequests) return new(429);
            bool serverError = (int)response.StatusCode >= 500;
            if (response.Content.Headers.ContentLength > 32768) return new(HttpServerError: serverError);
            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var body = new MemoryStream();
            var buffer = new byte[4096]; int count;
            while ((count = await stream.ReadAsync(buffer, ct)) > 0)
            {
                if (body.Length + count > 32768) return new(HttpServerError: serverError);
                body.Write(buffer, 0, count);
            }
            using var json = JsonDocument.Parse(body.ToArray(), new JsonDocumentOptions { MaxDepth = 16 });
            var root = json.RootElement;
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty("return", out var result) || result.ValueKind != JsonValueKind.Object ||
                !result.TryGetProperty("status", out var status) || !status.TryGetInt32(out int code)) return new(HttpServerError: serverError);
            Entry? entry = null;
            if (root.TryGetProperty("entries", out var entries) && entries.ValueKind == JsonValueKind.Array && entries.GetArrayLength() == 1)
            {
                var item = entries[0];
                if (item.ValueKind == JsonValueKind.Object && item.TryGetProperty("messageid", out var messageId) && messageId.TryGetInt64(out long id) &&
                    item.TryGetProperty("status", out var state) && state.TryGetInt32(out int delivery))
                    entry = new(id, delivery, item.TryGetProperty("receptor", out var receptor) && receptor.ValueKind == JsonValueKind.String ? receptor.GetString() : null);
            }
            return new(code, response.IsSuccessStatusCode, serverError, entry);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception error) when (error is HttpRequestException or OperationCanceledException or JsonException or InvalidOperationException or IOException)
        { return new(); }
    }

    private sealed record Entry(long Id, int State, string? Phone);
    private sealed record Reply(int? Code = null, bool HttpSuccess = false, bool HttpServerError = false, Entry? Entry = null);
}
