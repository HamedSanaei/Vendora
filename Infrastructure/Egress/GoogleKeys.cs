using Application.Auth;
using Application.Egress;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text.Json;

namespace Infrastructure.Egress;

/// <summary>Validates ID tokens with the existing JWT library and official keys through the Google egress route.</summary>
public sealed class GoogleKeys(IHttpClientFactory clients, EgressNetwork network, TimeProvider time) : IGoogleCredentialVerifier
{
    private readonly SemaphoreSlim _gate = new(1);
    private KeyCache? _cache;
    private sealed record KeyCache(string Revision, DateTimeOffset Until, SecurityKey[] Keys);

    /// <inheritdoc />
    public async Task<GoogleIdentity?> VerifyAsync(string credential, string audience, CancellationToken ct)
    {
        var tokens = new JwtSecurityTokenHandler { MapInboundClaims = false, MaximumTokenSizeInBytes = 12000 };
        if (!tokens.CanReadToken(credential)) return null;
        try
        {
            var token = tokens.ReadJwtToken(credential);
            if (token.Header.Alg != SecurityAlgorithms.RsaSha256 || string.IsNullOrWhiteSpace(token.Header.Kid)) return null;
            var keys = await GetKeysAsync(ct);
            var principal = tokens.ValidateToken(credential, new TokenValidationParameters
            {
                ValidAlgorithms = [SecurityAlgorithms.RsaSha256],
                ValidIssuers = ["https://accounts.google.com", "accounts.google.com"],
                ValidAudience = audience, IgnoreTrailingSlashWhenValidatingAudience = false,
                IssuerSigningKeys = keys, TryAllIssuerSigningKeys = false,
                ValidateIssuer = true, ValidateAudience = true, ValidateIssuerSigningKey = true,
                RequireSignedTokens = true, RequireExpirationTime = true, ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            }, out _);
            string? subject = principal.FindFirst("sub")?.Value;
            string? email = principal.FindFirst("email")?.Value;
            if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(email)
                || !bool.TryParse(principal.FindFirst("email_verified")?.Value, out bool verified) || !verified)
                return null;
            return new(subject, email, principal.FindFirst("name")?.Value,
                principal.FindFirst("given_name")?.Value, principal.FindFirst("family_name")?.Value);
        }
        catch (Exception e) when (e is SecurityTokenException or ArgumentException) { return null; }
    }

    /// <summary>Caches keys within the upstream lifetime, separately for each persisted route revision.</summary>
    private async Task<SecurityKey[]> GetKeysAsync(CancellationToken ct)
    {
        var route = await network.ReadRouteAsync(EgressCatalog.Google, ct);
        await _gate.WaitAsync(ct);
        try
        {
            if (_cache is { } current && current.Revision == route.Revision && current.Until > time.GetUtcNow())
                return current.Keys;
            using var client = clients.CreateClient("GoogleJwks");
            using var response = await client.GetAsync(EgressCatalog.Services[EgressCatalog.Google].Probe, ct);
            response.EnsureSuccessStatusCode();
            SecurityKey[] keys;
            try { keys = Parse(await response.Content.ReadAsStringAsync(ct)); }
            catch (Exception e) when (e is JsonException or ArgumentException)
            { throw new HttpRequestException("GOOGLE_KEYS_INVALID"); }
            if (keys.Length == 0) throw new HttpRequestException("GOOGLE_KEYS_INVALID");
            var ttl = response.Headers.CacheControl;
            var duration = ttl is { NoCache: true } or { NoStore: true } ? TimeSpan.Zero
                : (ttl?.MaxAge ?? TimeSpan.FromMinutes(5)) - (response.Headers.Age ?? TimeSpan.Zero);
            _cache = new(route.Revision, time.GetUtcNow().AddSeconds(Math.Clamp(duration.TotalSeconds, 0, 300)), keys);
            return keys;
        }
        finally { _gate.Release(); }
    }

    /// <summary>Accepts only usable RSA signing keys from Google's official JWKS document.</summary>
    internal static SecurityKey[] Parse(string body)
    {
        using var document = JsonDocument.Parse(body);
        if (document.RootElement.ValueKind != JsonValueKind.Object ||
            !document.RootElement.TryGetProperty("keys", out var keys) || keys.ValueKind != JsonValueKind.Array)
            return [];
        return new JsonWebKeySet(body).Keys.Where(key => key.Kty == "RSA" && key.Alg is null or "RS256"
            && key.Use is null or "sig" && !string.IsNullOrEmpty(key.Kid) && !string.IsNullOrEmpty(key.N)
            && !string.IsNullOrEmpty(key.E)).Cast<SecurityKey>().ToArray();
    }
}
