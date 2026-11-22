using Application.Accounting;
using Application.Egress;
using Domain.Entities;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Persistence;
using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using System.Security.Cryptography;

namespace Infrastructure.Egress;

/// <summary>Applies persisted egress policy on each new HTTP request and never falls back from a required route.</summary>
public sealed class EgressNetwork(IDbContextFactory<AppDbContext> factory, IDataProtectionProvider protection,
    IConfiguration configuration, TimeProvider time) : IEgressNetwork
{
    internal Func<SocketsHttpConnectionContext, CancellationToken, ValueTask<Stream>> Connector { get; init; } = ConnectPublicAsync;
    /// <summary>Creates the primary handler for the existing adapter without using process-wide proxy variables.</summary>
    public HttpMessageHandler For(string service) => new RoutedHandler(this, service);

    /// <summary>9Router remains direct-only when configured as an internal HTTP service.</summary>
    public bool CanProxy(string service) => service != EgressCatalog.Seo || SeoBase()?.Scheme == Uri.UriSchemeHttps;

    /// <summary>Rejects unsafe proxy endpoints on save; the same check also runs at connection time.</summary>
    public async Task ValidateProxyAsync(string host, CancellationToken ct)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(5));
        try { await PublicAddressesAsync(host, timeout.Token); }
        catch (Exception e) when (!ct.IsCancellationRequested && e is SocketException or HttpRequestException or OperationCanceledException)
        { throw new AccountingException("EGRESS_PROXY_HOST_UNREACHABLE", 400); }
    }

    /// <summary>Loads the current mode and revision for HTTP routing and route-specific Google key caching.</summary>
    public async Task<(EgressProxy? Profile, string Revision, bool Required)> ReadRouteAsync(string service, CancellationToken ct)
    {
        await using var db = await factory.CreateDbContextAsync(ct);
        var route = await db.EgressRoutes.AsNoTracking().Include(x => x.Proxy).SingleOrDefaultAsync(x => x.Service == service, ct);
        return route?.Enabled == true ? (route.Proxy, $"{route.Version}:{route.Proxy?.Version}", true) : (null, "direct", false);
    }

    /// <summary>Sends a bounded GET to a fixed integration endpoint without sending any integration credentials.</summary>
    public async Task<EgressCheck> ProbeAsync(string service, EgressProxy? profile, CancellationToken ct)
    {
        var spec = EgressCatalog.Services[service];
        Uri? target = spec.Probe ?? (SeoBase() is Uri url ? new Uri(url.AbsoluteUri.TrimEnd('/') + "/models") : null);
        var result = new EgressCheck { At = time.GetUtcNow(), Path = profile is null ? "Direct" : "Proxy" };
        if (target is null) { result.Code = "NotConfigured"; return result; }
        var clock = Stopwatch.StartNew();
        try
        {
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(profile?.TimeoutSeconds ?? 10));
            using var request = new HttpRequestMessage(HttpMethod.Get, target);
            using var response = await SendAsync(service, profile, request, timeout.Token, probe: true);
            int status = (int)response.StatusCode;
            result.Code = response.IsSuccessStatusCode ? "Success" : $"UpstreamHttp:{status}";
            if (service == EgressCatalog.Google && response.IsSuccessStatusCode)
                result.Code = GoogleKeys.Parse(await response.Content.ReadAsStringAsync(timeout.Token)).Length > 0 ? "Success" : "InvalidResponse";
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { result.Code = "Timeout"; }
        catch (HttpRequestException ex)
        {
            result.Code = ex.StatusCode == HttpStatusCode.ProxyAuthenticationRequired ? "ProxyAuthentication"
                : ex.HttpRequestError == HttpRequestError.SecureConnectionError ? "TlsError"
                : ex.Message == "EGRESS_ROUTE_UNAVAILABLE" ? "ProfileDisabled" : "ConnectionFailed";
        }
        catch (Exception ex) when (ex is JsonException or ArgumentException) { result.Code = "InvalidResponse"; }
        result.Milliseconds = clock.ElapsedMilliseconds;
        return result;
    }

    /// <summary>Allows configured 9Router origins and exact official integration hosts, with redirects disabled.</summary>
    private async Task<HttpResponseMessage> SendAsync(string service, EgressProxy? profile, HttpRequestMessage request,
        CancellationToken ct, bool probe = false)
    {
        var spec = EgressCatalog.Services[service];
        var destination = request.RequestUri;
        var seo = service == EgressCatalog.Seo ? SeoBase() : null;
        bool permitted = destination is { IsAbsoluteUri: true, UserInfo.Length: 0 } &&
            (seo is not null ? seo.Scheme == destination.Scheme && seo.IdnHost == destination.IdnHost && seo.Port == destination.Port
                : destination.Scheme == "https" && destination.IsDefaultPort && spec.Hosts.Contains(destination.IdnHost));
        if (!permitted || request.Headers.Host is not null || request.Headers.Contains("Proxy-Authorization"))
            throw new HttpRequestException("EGRESS_DESTINATION_BLOCKED");
        if (profile is { Enabled: false }) throw new HttpRequestException("EGRESS_ROUTE_UNAVAILABLE");
        if (profile is not null && (destination!.Scheme != "https" || !CanProxy(service)))
            throw new HttpRequestException("EGRESS_DESTINATION_BLOCKED");
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        if (profile is not null) timeout.CancelAfter(TimeSpan.FromSeconds(profile.TimeoutSeconds));
        try
        {
            // Fixed official hosts are safe remote-DNS targets. A configured SEO destination must
            // also resolve publicly before proxying. Internal 9Router stays direct and unprobed if HTTP.
            if (seo is not null && (profile is not null || probe)) await PublicAddressesAsync(destination!.IdnHost, timeout.Token);
            using var handler = CreateTransport(profile is null ? null : MakeProxy(profile));
            handler.ConnectCallback = seo is not null && profile is null && !probe ? null : Connector;
            using var invoker = new HttpMessageInvoker(handler, disposeHandler: false);
            var response = await invoker.SendAsync(request, timeout.Token);
            try
            {
                await response.Content.LoadIntoBufferAsync(spec.MaxBytes, timeout.Token);
                return response;
            }
            catch { response.Dispose(); throw; }
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested && !probe)
        { throw new HttpRequestException("EGRESS_TIMEOUT"); }
        catch (Exception ex) when (ex is CryptographicException or SocketException or JsonException)
        { throw new HttpRequestException("EGRESS_CONNECTION_FAILED"); }
    }

    /// <summary>Reads only a deployment-configured origin, never caller-supplied URLs.</summary>
    private Uri? SeoBase() => Uri.TryCreate(configuration["SeoAi:BaseUrl"], UriKind.Absolute, out var uri)
        && uri.Scheme is "http" or "https" && string.IsNullOrEmpty(uri.UserInfo) ? uri : null;

    /// <summary>Uses .NET proxy negotiation and certificate validation without cookie sharing or redirects.</summary>
    internal static SocketsHttpHandler CreateTransport(WebProxy? proxy) => new()
    {
        UseProxy = proxy is not null, Proxy = proxy, AllowAutoRedirect = false, UseCookies = false,
        MaxResponseHeadersLength = 32, ConnectCallback = ConnectPublicAsync
    };

    /// <summary>Creates the runtime's HTTP CONNECT / HTTPS CONNECT / SOCKS5 proxy with scoped credentials.</summary>
    private WebProxy MakeProxy(EgressProxy profile)
    {
        var proxy = new WebProxy(new UriBuilder(profile.Scheme, profile.Host, profile.Port).Uri);
        if (profile.Credential is not null)
        {
            var json = protection.CreateProtector(ManageEgress.CredentialPurpose, profile.Id.ToString()).Unprotect(profile.Credential);
            var credential = JsonSerializer.Deserialize<ManageEgress.Credential>(json) ?? throw new CryptographicException();
            proxy.Credentials = new NetworkCredential(credential.User, credential.Password);
        }
        return proxy;
    }

    /// <summary>Resolves once and connects to those exact checked addresses, preserving TLS hostname checks.</summary>
    private static async ValueTask<Stream> ConnectPublicAsync(SocketsHttpConnectionContext context, CancellationToken ct)
    {
        var endpoint = context.DnsEndPoint;
        var addresses = await PublicAddressesAsync(endpoint.Host, ct);
        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            await socket.ConnectAsync(addresses, endpoint.Port, ct);
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch { socket.Dispose(); throw; }
    }

    /// <summary>Discards no answers: a DNS name mixing public and restricted records is rejected.</summary>
    private static async Task<IPAddress[]> PublicAddressesAsync(string host, CancellationToken ct)
    {
        if (!IPAddress.TryParse(host, out _) && !host.TrimEnd('.').Contains('.'))
            throw new HttpRequestException("EGRESS_DESTINATION_BLOCKED");
        var addresses = await Dns.GetHostAddressesAsync(host, ct);
        if (addresses.Length == 0 || addresses.Any(x => !IsPublic(x)))
            throw new HttpRequestException("EGRESS_DESTINATION_BLOCKED");
        return addresses;
    }

    /// <summary>Accepts only globally routable addresses, excluding local, metadata, mapped and transition ranges.</summary>
    public static bool IsPublic(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6) return IsPublic(address.MapToIPv4());
        var b = address.GetAddressBytes();
        if (b.Length == 4)
            return b[0] is not (0 or 10 or 127) and < 224 && !(b[0] == 169 && b[1] == 254)
                && !(b[0] == 172 && b[1] is >= 16 and <= 31) && !(b[0] == 192 && b[1] == 168)
                && !(b[0] == 100 && b[1] is >= 64 and <= 127) && !(b[0] == 198 && b[1] is 18 or 19)
                && !(b[0] == 192 && (b[1] == 0 && b[2] is 0 or 2 || b[1] == 88 && b[2] == 99))
                && !(b[0] == 198 && b[1] == 51 && b[2] == 100)
                && !(b[0] == 203 && b[1] == 0 && b[2] == 113)
                && !b.SequenceEqual(new byte[] { 168, 63, 129, 16 });
        return (b[0] & 0xe0) == 0x20 && !(b[0] == 0x20 && b[1] == 0x02)
            && !(b[0] == 0x20 && b[1] == 0x01 && (b[2] < 2 || b[2] == 0x0d && b[3] == 0xb8))
            && !(b[0] == 0x3f && b[1] == 0xff);
    }

    private sealed class RoutedHandler(EgressNetwork network, string service) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            var route = await network.ReadRouteAsync(service, ct);
            if (route.Required && route.Profile is null) throw new HttpRequestException("EGRESS_ROUTE_UNAVAILABLE");
            return await network.SendAsync(service, route.Profile, request, ct);
        }
    }
}
