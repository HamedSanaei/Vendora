using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Interfaces;

namespace Infrastructure.Pricing;

/// <summary>Bounded, unauthenticated market reads, normalized explicitly from Rial or Toman.</summary>
public sealed class PublicUsdtRateSource(string name, IHttpClientFactory clients) : IUsdtRateSource
{
    /// <inheritdoc />
    public string Name => name;

    /// <inheritdoc />
    public async Task<UsdtRateQuote?> ReadAsync(CancellationToken cancellationToken)
    {
        string? url;
        string path;
        decimal divisor;
        switch (Name)
        {
            case "Nobitex":
                url = "https://apiv2.nobitex.ir/market/stats?srcCurrency=usdt&dstCurrency=rls";
                path = "stats.usdt-rls.latest";
                divisor = 10m;
                break;
            case "Wallex":
                url = "https://api.wallex.ir/v1/markets";
                path = "result.symbols.USDTTMN.stats.lastPrice";
                divisor = 1m;
                break;
            case "AbanTether":
                url = "https://api.abantether.com/api/v1/manager/otc/ticker?coin=USDT";
                path = "data.markets.USDTIRT.buy_price";
                divisor = 1m;
                break;
            default:
                return null;
        }

        var client = clients.CreateClient("UsdtPublicRates");
        using var response = await client.GetAsync(url, HttpCompletionOption.ResponseContentRead, cancellationToken);
        response.EnsureSuccessStatusCode();
        using var document = await response.Content.ReadFromJsonAsync<JsonDocument>(cancellationToken: cancellationToken);
        if (document is null) return null;
        if (Name == "Nobitex" && (!document.RootElement.TryGetProperty("status", out var status) || status.GetString() != "ok")) return null;
        if (Name == "Wallex" && (!document.RootElement.TryGetProperty("success", out var success) || success.ValueKind != JsonValueKind.True)) return null;
        if (Name == "Nobitex" && document.RootElement.GetProperty("stats").GetProperty("usdt-rls")
            .TryGetProperty("isClosed", out var closed) && closed.ValueKind == JsonValueKind.True) return null;

        if (Name == "AbanTether")
        {
            var market = document.RootElement.GetProperty("data").GetProperty("markets").GetProperty("USDTIRT");
            if (!market.TryGetProperty("active", out var active) || active.ValueKind != JsonValueKind.True) return null;
            var buy = ReadDecimal(market, "buy_price");
            var sell = ReadDecimal(market, "sell_price");
            if (buy is not > 0 || sell is not > 0 || buy < sell) return null;
            // OTC has buy/sell quotes instead of a last trade. Use its midpoint, already in Toman.
            return new UsdtRateQuote(Name, (buy.Value + sell.Value) / 2m);
        }

        decimal? value = ReadDecimal(document.RootElement, path);
        return value is > 0 ? new UsdtRateQuote(Name, value.Value / divisor) : null;
    }

    /// <summary>Reads only an explicitly specified JSON field using invariant decimal parsing.</summary>
    public static decimal? ReadDecimal(JsonElement root, string path)
    {
        foreach (string key in path.Split('.'))
        {
            if (root.ValueKind != JsonValueKind.Object || !root.TryGetProperty(key, out root)) return null;
        }
        if (root.ValueKind == JsonValueKind.Number && root.TryGetDecimal(out var number)) return number;
        return root.ValueKind == JsonValueKind.String
            && decimal.TryParse(root.GetString(), NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out number)
                ? number : null;
    }
}
