using Application.Egress;
using Domain.Entities;
using Infrastructure.Egress;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Persistence;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Net.Security;
using System.Net.Sockets;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Exercises the persisted policy, admin API, live .NET proxy negotiation and token verification in isolation.</summary>
public sealed class EgressTests
{
    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("169.254.169.254")]
    [InlineData("168.63.129.16")]
    [InlineData("100.100.100.200")]
    [InlineData("192.168.1.1")]
    [InlineData("::ffff:10.1.2.3")]
    [InlineData("::1")]
    [InlineData("fc00::1")]
    [InlineData("fe80::1")]
    public void RestrictedAddressesAreBlocked(string value) => Assert.False(EgressNetwork.IsPublic(IPAddress.Parse(value)));

    [Fact]
    public async Task AdminApi_PersistsEncryptedCredentials_AndRejectsUnauthorizedOrPrivateRoutes()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync(services =>
        {
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
            services.AddSingleton<IEgressNetwork>(sp => new EgressNetwork(null!, sp.GetRequiredService<IDataProtectionProvider>(),
                new ConfigurationBuilder().Build(), TimeProvider.System));
        });
        using var guest = host.Client(null);
        using var customer = host.Client("Customer");
        using var admin = host.Client("Admin");
        admin.DefaultRequestHeaders.Add("Test-User", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/admin/egress")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.GetAsync("/api/admin/egress")).StatusCode);
        var request = new ManageEgress.ProfileInput(null, null, "Test proxy", "socks5", "8.8.8.8", 1234, 8, true,
            null, "fixture-user", "fixture-password");
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync("/api/admin/egress/profiles", request with { Host = "127.0.0.1" })).StatusCode);
        using var created = await admin.PutAsJsonAsync("/api/admin/egress/profiles", request);
        created.EnsureSuccessStatusCode();
        string body = await created.Content.ReadAsStringAsync();
        Assert.DoesNotContain("fixture-", body);
        var profile = (await created.Content.ReadFromJsonAsync<ManageEgress.ProfileView>())!;
        Assert.True(profile.HasCredential);
        using (var scope = host.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var stored = await db.EgressProxies.SingleAsync();
            Assert.DoesNotContain("fixture-", stored.Credential);
            var edit = request with { Id = profile.Id, Version = profile.Version, Name = "Renamed", User = null, Password = null };
            (await admin.PutAsJsonAsync("/api/admin/egress/profiles", edit)).EnsureSuccessStatusCode();
            Assert.Equal(stored.Credential, (await db.EgressProxies.AsNoTracking().SingleAsync()).Credential);
            Assert.Equal(HttpStatusCode.Conflict, (await admin.PutAsJsonAsync("/api/admin/egress/profiles", edit)).StatusCode);
        }
        var before = (await admin.GetFromJsonAsync<ManageEgress.Settings>("/api/admin/egress"))!;
        Assert.All(before.Routes, route => Assert.False(route.Enabled));
        (await admin.PutAsJsonAsync("/api/admin/egress/routes/google", new { enabled = true, proxyId = profile.Id })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsJsonAsync("/api/admin/egress/test", new { service = "https://localhost" })).StatusCode);
        var after = (await admin.GetFromJsonAsync<ManageEgress.Settings>("/api/admin/egress"))!;
        Assert.Equal(profile.Id, after.Routes.Single(x => x.Service == "google").ProxyId);
        Assert.False(after.Routes.Single(x => x.Service == "tabapay").Enabled);
        Assert.Equal(3, after.Audit.Length);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.DeleteAsync($"/api/admin/egress/profiles/{profile.Id}?version={after.Profiles[0].Version}")).StatusCode);
    }

    [Theory]
    [InlineData("http")]
    [InlineData("https")]
    [InlineData("socks5")]
    public async Task RuntimeUsesSelectedProxyAndRejectsUntrustedTls(string scheme)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        CancellationToken ct = timeout.Token;
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        using var certificateKey = RSA.Create(2048);
        using var cert = new CertificateRequest("CN=untrusted.example", certificateKey, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1)
            .CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddMinutes(5));
        var remote = Task.Run(async () =>
        {
            using var accepted = await listener.AcceptTcpClientAsync(ct);
            await using var stream = accepted.GetStream();
            if (scheme == "https")
            {
                // An untrusted HTTPS proxy must fail TLS before receiving CONNECT or a password.
                await ExpectRejectedTlsAsync(stream, cert, ct);
                return;
            }
            if (scheme == "socks5")
            {
                byte[] greeting = await ReadAsync(stream, 2, ct);
                Assert.Equal((byte)5, greeting[0]);
                Assert.Contains((byte)2, await ReadAsync(stream, greeting[1], ct));
                await stream.WriteAsync(new byte[] { 5, 2 }, ct);
                byte[] login = await ReadAsync(stream, 2, ct);
                Assert.Equal((byte)1, login[0]);
                Assert.Equal("fixture-user", Encoding.ASCII.GetString(await ReadAsync(stream, login[1], ct)));
                int passLength = (await ReadAsync(stream, 1, ct))[0];
                Assert.Equal("fixture-pass", Encoding.ASCII.GetString(await ReadAsync(stream, passLength, ct)));
                await stream.WriteAsync(new byte[] { 1, 0 }, ct);
                byte[] request = await ReadAsync(stream, 5, ct);
                Assert.Equal(new byte[] { 5, 1, 0, 3 }, request[..4]); // DNS name is sent to the proxy.
                Assert.Equal("www.googleapis.com", Encoding.ASCII.GetString(await ReadAsync(stream, request[4], ct)));
                Assert.Equal(new byte[] { 1, 187 }, await ReadAsync(stream, 2, ct));
                await stream.WriteAsync(new byte[] { 5, 0, 0, 1, 0, 0, 0, 0, 0, 0 }, ct);
            }
            else
            {
                string head = await ReadHeadersAsync(stream, ct);
                Assert.StartsWith("CONNECT www.googleapis.com:443 HTTP/1.1", head);
                await stream.WriteAsync("HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm=\"fixture\"\r\nContent-Length: 0\r\n\r\n"u8.ToArray(), ct);
                head = await ReadHeadersAsync(stream, ct);
                Assert.Contains("Proxy-Authorization: Basic " + Convert.ToBase64String("fixture-user:fixture-pass"u8), head, StringComparison.OrdinalIgnoreCase);
                await stream.WriteAsync("HTTP/1.1 200 Connection Established\r\n\r\n"u8.ToArray(), ct);
            }
            await ExpectRejectedTlsAsync(stream, cert, ct);
        }, ct);

        var proxy = new WebProxy(new UriBuilder(scheme, "fixture.example", port).Uri)
        {
            Credentials = new NetworkCredential("fixture-user", "fixture-pass")
        };
        using var handler = EgressNetwork.CreateTransport(proxy);
        handler.ConnectCallback = async (context, token) =>
        {
            Assert.Equal("fixture.example", context.DnsEndPoint.Host);
            var client = new Socket(SocketType.Stream, ProtocolType.Tcp);
            try { await client.ConnectAsync(IPAddress.Loopback, port, token); return new NetworkStream(client, ownsSocket: true); }
            catch { client.Dispose(); throw; }
        };
        using var browser = new HttpClient(handler);
        await Assert.ThrowsAsync<HttpRequestException>(() => browser.GetAsync("https://www.googleapis.com/oauth2/v3/certs", ct));
        await remote.WaitAsync(ct);
    }

    [Fact]
    public async Task SavedRouteTakesEffectForExistingClient_AndRequiredFailureCannotFallback()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var factory = new Factory(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await using var db = factory.CreateDbContext();
        await db.Database.MigrateAsync();
        var connected = new List<string>();
        var network = new EgressNetwork(factory, new EphemeralDataProtectionProvider(), new ConfigurationBuilder().Build(), TimeProvider.System)
        {
            Connector = (context, _) =>
            {
                connected.Add(context.DnsEndPoint.Host);
                return ValueTask.FromException<Stream>(new HttpRequestException("fixture unreachable"));
            }
        };
        using var client = new HttpClient(network.For(EgressCatalog.Google));
        const string url = "https://www.googleapis.com/oauth2/v3/certs";
        await Assert.ThrowsAsync<HttpRequestException>(() => client.GetAsync("https://www.googleapis.com.invalid/"));
        Assert.Empty(connected);
        await Assert.ThrowsAsync<HttpRequestException>(() => client.GetAsync(url));
        Assert.NotEmpty(connected);
        Assert.All(connected, host => Assert.Equal("www.googleapis.com", host));
        var profile = new EgressProxy { Id = Guid.NewGuid(), Version = Guid.NewGuid(), Name = "Test", Host = "fixture.example", Port = 4321, Enabled = true };
        var route = new EgressRoute { Service = EgressCatalog.Google, Version = Guid.NewGuid(), Proxy = profile, Enabled = true };
        db.AddRange(profile, route);
        await db.SaveChangesAsync();
        connected.Clear();
        await Assert.ThrowsAsync<HttpRequestException>(() => client.GetAsync(url));
        Assert.NotEmpty(connected);
        Assert.All(connected, host => Assert.Equal("fixture.example", host));
        profile.Enabled = false;
        await db.SaveChangesAsync();
        connected.Clear();
        await Assert.ThrowsAsync<HttpRequestException>(() => client.GetAsync(url));
        Assert.Empty(connected);
        route.Enabled = false;
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<HttpRequestException>(() => client.GetAsync(url));
        Assert.NotEmpty(connected);
        Assert.All(connected, host => Assert.Equal("www.googleapis.com", host));
    }

    [Fact]
    public async Task GoogleVerificationAcceptsValidSignatureButRejectsWrongIssuerAudienceExpiryAndForgedTokens()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        var factory = new Factory(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await using var db = factory.CreateDbContext();
        await db.Database.MigrateAsync();
        using var signer = RSA.Create(2048);
        using var impostor = RSA.Create(2048);
        var publicKey = signer.ExportParameters(false);
        var json = JsonSerializer.Serialize(new { keys = new[] { new { kty = "RSA", alg = "RS256", kid = "fixture", use = "sig",
            n = Base64UrlEncoder.Encode(publicKey.Modulus), e = Base64UrlEncoder.Encode(publicKey.Exponent) } } });
        using var transport = new GoogleFixture(json);
        var network = new EgressNetwork(factory, new EphemeralDataProtectionProvider(), new ConfigurationBuilder().Build(), TimeProvider.System);
        var verifier = new GoogleKeys(transport, network, TimeProvider.System);
        const string audience = "test.apps.googleusercontent.com";
        string Token(RSA key, string issuer = "https://accounts.google.com", string target = audience, int minutes = 5, bool verified = true) =>
            new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(issuer, target,
                [new("sub", "google-subject"), new("email", "fixture@example.invalid"), new("email_verified", verified.ToString().ToLowerInvariant(), ClaimValueTypes.Boolean)],
                expires: DateTime.UtcNow.AddMinutes(minutes), signingCredentials: new(new RsaSecurityKey(key) { KeyId = "fixture" }, SecurityAlgorithms.RsaSha256)));
        Assert.Equal("google-subject", (await verifier.VerifyAsync(Token(signer), audience, default))?.Subject);
        Assert.Null(await verifier.VerifyAsync(Token(signer, issuer: "https://other.example"), audience, default));
        Assert.Null(await verifier.VerifyAsync(Token(signer, target: "wrong"), audience, default));
        Assert.Null(await verifier.VerifyAsync(Token(signer, minutes: -1), audience, default));
        Assert.Null(await verifier.VerifyAsync(Token(signer, verified: false), audience, default));
        Assert.Null(await verifier.VerifyAsync(Token(impostor), audience, default));
        Assert.Equal(1, transport.Calls);
    }

    private sealed class Factory(DbContextOptions<AppDbContext> options) : IDbContextFactory<AppDbContext>
    {
        public AppDbContext CreateDbContext() => new(options);
    }

    private sealed class GoogleFixture(string json) : HttpMessageHandler, IHttpClientFactory
    {
        public int Calls { get; private set; }
        public HttpClient CreateClient(string name) => new(this, disposeHandler: false);
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Assert.Equal("https://www.googleapis.com/oauth2/v3/certs", request.RequestUri!.AbsoluteUri);
            Calls++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(json) });
        }
    }

    /// <summary>Reads a bounded test protocol field without assuming packet boundaries.</summary>
    private static async Task<byte[]> ReadAsync(Stream stream, int count, CancellationToken ct)
    {
        byte[] data = new byte[count];
        await stream.ReadExactlyAsync(data, ct);
        return data;
    }

    /// <summary>Reads the CONNECT header without consuming bytes from the following TLS handshake.</summary>
    private static async Task<string> ReadHeadersAsync(Stream stream, CancellationToken ct)
    {
        var header = new StringBuilder();
        while (header.Length < 4096)
        {
            header.Append((char)(await ReadAsync(stream, 1, ct))[0]);
            if (header.ToString().EndsWith("\r\n\r\n", StringComparison.Ordinal)) return header.ToString();
        }
        throw new InvalidOperationException("Oversized fixture header");
    }

    /// <summary>Runs a TLS peer with a self-signed certificate; the client must never send application data.</summary>
    private static async Task ExpectRejectedTlsAsync(Stream stream, X509Certificate2 cert, CancellationToken ct)
    {
        await using var tls = new SslStream(stream, leaveInnerStreamOpen: true);
        try
        {
            await tls.AuthenticateAsServerAsync(new SslServerAuthenticationOptions { ServerCertificate = cert }, ct);
            Assert.Equal(0, await tls.ReadAsync(new byte[1], ct));
        }
        catch (Exception ex) when (ex is IOException or System.Security.Authentication.AuthenticationException) { }
    }
}
