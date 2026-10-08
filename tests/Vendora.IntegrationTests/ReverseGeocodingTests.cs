using System.Collections.Concurrent;
using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using API.Controllers;
using Application.Addresses;
using Application.Interfaces;
using Infrastructure.Maps;
using MediatR;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Exercises authenticated address lookup through real MVC, mediator and the Neshan adapter without external traffic.</summary>
public sealed class ReverseGeocodingTests
{
    private const string Endpoint = "/api/account/addresses/reverse-geocode";
    private const string FakeServiceKey = "service.integration-test-placeholder";
    private const string UpstreamSecret = "upstream-private-diagnostic";
    private const string Address = "  تهران، خیابان آزادی  ";

    /// <summary>Anonymous requests cannot consume provider quota.</summary>
    [Fact]
    public async Task AnonymousLookup_IsUnauthorizedWithoutOutboundRequest()
    {
        using var provider = SuccessfulProvider();
        await using var host = await LookupHost.CreateAsync(provider);
        using var response = await host.Client.GetAsync(Endpoint + "?latitude=35&longitude=51");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Empty(provider.Requests);
    }

    /// <summary>Missing, malformed, nonfinite and outside-region query pairs fail before provider access.</summary>
    [Theory]
    [InlineData("")]
    [InlineData("?latitude=35")]
    [InlineData("?longitude=51")]
    [InlineData("?latitude=not-a-number&longitude=51")]
    [InlineData("?latitude=NaN&longitude=51")]
    [InlineData("?latitude=Infinity&longitude=51")]
    [InlineData("?latitude=35&longitude=-Infinity")]
    [InlineData("?latitude=24.9999&longitude=51")]
    [InlineData("?latitude=40.0001&longitude=51")]
    [InlineData("?latitude=35&longitude=43.9999")]
    [InlineData("?latitude=35&longitude=63.5001")]
    public async Task InvalidQuery_IsRejectedWithoutOutboundRequest(string query)
    {
        using var provider = SuccessfulProvider();
        await using var host = await LookupHost.CreateAsync(provider);
        using var client = host.CreateAuthenticatedClient();
        using var response = await client.GetAsync(Endpoint + query);
        await AssertFailureAsync(response, HttpStatusCode.BadRequest, "invalid_coordinates");
        Assert.Empty(provider.Requests);
    }

    /// <summary>Use-case validation protects non-HTTP callers from nonfinite coordinates too.</summary>
    [Theory]
    [InlineData(double.NaN, 51)]
    [InlineData(double.PositiveInfinity, 51)]
    [InlineData(double.NegativeInfinity, 51)]
    [InlineData(35, double.NaN)]
    [InlineData(35, double.PositiveInfinity)]
    [InlineData(35, double.NegativeInfinity)]
    public async Task NonfiniteUseCaseInput_IsRejectedWithoutOutboundRequest(double latitude, double longitude)
    {
        using var provider = SuccessfulProvider();
        await using var host = await LookupHost.CreateAsync(provider);
        using var scope = host.App.Services.CreateScope();
        var result = await scope.ServiceProvider.GetRequiredService<ISender>().Send(new ReverseGeocode.Query(latitude, longitude));
        Assert.Equal(ReverseGeocode.Failure.InvalidCoordinates, result.Failure);
        Assert.Null(result.FormattedAddress);
        Assert.Empty(provider.Requests);
    }

    /// <summary>Valid selections, including rectangle edges, return the provider's unmodified Persian address.</summary>
    [Theory]
    [InlineData(35.6892, 51.389)]
    [InlineData(25, 44)]
    [InlineData(40, 63.5)]
    public async Task Lookup_ReturnsProviderAddressAndOnlyServerCredential(double latitude, double longitude)
    {
        using var provider = SuccessfulProvider();
        await using var host = await LookupHost.CreateAsync(provider);
        using var client = host.CreateAuthenticatedClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "customer-token-placeholder");
        client.DefaultRequestHeaders.Add("Cookie", "session=customer-cookie-placeholder");
        string query = FormattableString.Invariant($"?latitude={latitude}&longitude={longitude}");
        using var response = await client.GetAsync(Endpoint + query);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(Address, body.RootElement.GetProperty("formattedAddress").GetString());
        Assert.Single(body.RootElement.EnumerateObject());
        AssertProviderRequest(Assert.Single(provider.Requests), latitude, longitude);
    }

    /// <summary>Missing or browser-only keys report configuration failure without any network access.</summary>
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("web.browser-key-placeholder")]
    public async Task InvalidServiceKey_IsUnavailableWithoutOutboundRequest(string? key)
    {
        using var provider = SuccessfulProvider();
        await using var host = await LookupHost.CreateAsync(provider, key);
        using var client = host.CreateAuthenticatedClient();
        using var response = await client.GetAsync(Endpoint + "?latitude=35&longitude=51");
        await AssertFailureAsync(response, HttpStatusCode.ServiceUnavailable, "address_lookup_not_configured");
        Assert.Empty(provider.Requests);
    }

    /// <summary>Provider errors and malformed payloads become safe envelopes, never upstream diagnostics or keys.</summary>
    [Theory]
    [InlineData("{\"status\":\"OK\"}", 200, 404, "address_lookup_not_found")]
    [InlineData("{\"status\":\"OK\",\"formatted_address\":\"   \"}", 200, 404, "address_lookup_not_found")]
    [InlineData("{\"status\":\"OK\",\"formatted_address\":null}", 200, 404, "address_lookup_not_found")]
    [InlineData("{\"status\":\"ERROR\",\"formatted_address\":\"must not return\"}", 200, 502, "address_lookup_failed")]
    [InlineData("{\"formatted_address\":\"must not return\"}", 200, 502, "address_lookup_failed")]
    [InlineData("{\"status\":\"OK\",\"formatted_address\":42}", 200, 502, "address_lookup_failed")]
    [InlineData("not-json", 200, 502, "address_lookup_failed")]
    [InlineData("[]", 200, 502, "address_lookup_failed")]
    [InlineData("{}", 401, 502, "address_lookup_failed")]
    [InlineData("{}", 429, 502, "address_lookup_failed")]
    [InlineData("{}", 500, 502, "address_lookup_failed")]
    public async Task ProviderFailure_ReturnsSafeHttpEnvelope(string payload, int upstreamStatus, int expectedStatus, string expectedCode)
    {
        string diagnostic = JsonSerializer.Serialize(UpstreamSecret + " " + FakeServiceKey);
        string providerBody = payload.StartsWith('{')
            ? payload[..^1] + (payload == "{}" ? "" : ",") + "\"diagnostic\":" + diagnostic + "}"
            : payload == "[]" ? "[" + diagnostic + "]" : payload + "\n" + diagnostic;
        using var provider = new ProviderHandler((_, _) => Task.FromResult(new HttpResponseMessage((HttpStatusCode)upstreamStatus)
        {
            Content = new StringContent(providerBody, Encoding.UTF8, "application/json"),
            ReasonPhrase = UpstreamSecret + " " + FakeServiceKey
        }));
        await using var host = await LookupHost.CreateAsync(provider);
        using var client = host.CreateAuthenticatedClient();
        using var response = await client.GetAsync(Endpoint + "?latitude=35&longitude=51");
        await AssertFailureAsync(response, (HttpStatusCode)expectedStatus, expectedCode);
        Assert.Single(provider.Requests);
    }

    /// <summary>Connection exceptions are contained at the provider boundary and do not expose their messages.</summary>
    [Fact]
    public async Task ConnectionFailure_ReturnsSafeHttpEnvelope()
    {
        using var provider = new ProviderHandler((_, _) => throw new HttpRequestException(UpstreamSecret + " " + FakeServiceKey));
        await using var host = await LookupHost.CreateAsync(provider);
        using var client = host.CreateAuthenticatedClient();
        using var response = await client.GetAsync(Endpoint + "?latitude=35&longitude=51");
        await AssertFailureAsync(response, HttpStatusCode.BadGateway, "address_lookup_failed");
        Assert.Single(provider.Requests);
    }

    /// <summary>Outbound coordinate formatting remains invariant under a decimal-comma caller culture.</summary>
    [Fact]
    public async Task Adapter_UsesInvariantCoordinatesUnderDecimalCommaCulture()
    {
        var original = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("fr-FR");
            using var provider = SuccessfulProvider();
            using var http = ProviderClient(provider);
            var adapter = new NeshanAddressGeocoder(http, Configuration(FakeServiceKey));
            var result = await adapter.ReverseAsync(35.6892, 51.389, CancellationToken.None);
            Assert.Equal(ReverseGeocode.Failure.None, result.Failure);
            Assert.Equal(Address, result.FormattedAddress);
            AssertProviderRequest(Assert.Single(provider.Requests), 35.6892, 51.389);
        }
        finally
        {
            CultureInfo.CurrentCulture = original;
        }
    }

    /// <summary>HttpClient's own timeout is an unavailable lookup, not a missing address or propagated caller cancellation.</summary>
    [Fact]
    public async Task Adapter_MapsProviderTimeoutToUnavailable()
    {
        using var provider = new ProviderHandler(async (_, token) =>
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, token);
            throw new InvalidOperationException("The controlled request must be cancelled.");
        });
        using var http = ProviderClient(provider);
        http.Timeout = TimeSpan.FromMilliseconds(100);
        var adapter = new NeshanAddressGeocoder(http, Configuration(FakeServiceKey));
        var result = await adapter.ReverseAsync(35, 51, CancellationToken.None).WaitAsync(TimeSpan.FromSeconds(10));
        Assert.Equal(ReverseGeocode.Failure.Unavailable, result.Failure);
        Assert.Null(result.FormattedAddress);
        Assert.Single(provider.Requests);
    }

    /// <summary>A cancellation requested by the caller is propagated rather than converted into a lookup failure.</summary>
    [Fact]
    public async Task Adapter_PreservesCallerCancellation()
    {
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        using var provider = new ProviderHandler(async (_, token) =>
        {
            entered.TrySetResult();
            await Task.Delay(Timeout.InfiniteTimeSpan, token);
            throw new InvalidOperationException("The controlled request must be cancelled.");
        });
        using var http = ProviderClient(provider);
        var adapter = new NeshanAddressGeocoder(http, Configuration(FakeServiceKey));
        using var cancellation = new CancellationTokenSource();
        var lookup = adapter.ReverseAsync(35, 51, cancellation.Token);
        await entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => lookup.WaitAsync(TimeSpan.FromSeconds(10)));
        Assert.Single(provider.Requests);
    }

    /// <summary>Checks the narrow public error contract and rejects diagnostic or credential leakage.</summary>
    private static async Task AssertFailureAsync(HttpResponseMessage response, HttpStatusCode expectedStatus, string expectedCode)
    {
        Assert.Equal(expectedStatus, response.StatusCode);
        string text = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(FakeServiceKey, text);
        Assert.DoesNotContain(UpstreamSecret, text);
        using var body = JsonDocument.Parse(text);
        Assert.Equal(new[] { "code", "message" }, body.RootElement.EnumerateObject().Select(property => property.Name).OrderBy(name => name).ToArray());
        Assert.Equal(expectedCode, body.RootElement.GetProperty("code").GetString());
    }

    /// <summary>Checks actual outgoing coordinates and proves account credentials never reach Neshan.</summary>
    private static void AssertProviderRequest(ProviderRequest request, double latitude, double longitude)
    {
        Assert.Equal(HttpMethod.Get, request.Method);
        Assert.Equal("https", request.Uri.Scheme);
        Assert.Equal("api.neshan.org", request.Uri.Host);
        Assert.Equal("/v5/reverse", request.Uri.AbsolutePath);
        var query = QueryHelpers.ParseQuery(request.Uri.Query);
        Assert.Equal(2, query.Count);
        Assert.Equal(latitude, double.Parse(query["lat"].ToString(), CultureInfo.InvariantCulture));
        Assert.Equal(longitude, double.Parse(query["lng"].ToString(), CultureInfo.InvariantCulture));
        Assert.Equal(FakeServiceKey, Assert.Single(request.Headers["Api-Key"]));
        Assert.False(request.Headers.ContainsKey("Authorization"));
        Assert.False(request.Headers.ContainsKey("Cookie"));
        Assert.False(request.Headers.ContainsKey("Test-User"));
        Assert.DoesNotContain(FakeServiceKey, request.Uri.AbsoluteUri);
    }

    /// <summary>Returns a fresh deterministic Neshan success response for each controlled request.</summary>
    private static ProviderHandler SuccessfulProvider() => new((_, _) => Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
    {
        Content = new StringContent(JsonSerializer.Serialize(new { status = "OK", formatted_address = Address }), Encoding.UTF8, "application/json")
    }));

    /// <summary>Builds an isolated configuration that cannot read developer or machine service keys.</summary>
    private static IConfiguration Configuration(string? key) => new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string, string?> { ["Neshan:ServiceApiKey"] = key }).Build();

    /// <summary>Creates an adapter client whose entire network boundary is controlled by the test.</summary>
    private static HttpClient ProviderClient(ProviderHandler provider) => new(provider, disposeHandler: false)
    {
        BaseAddress = new Uri("https://api.neshan.org/"),
        Timeout = TimeSpan.FromSeconds(8)
    };

    /// <summary>Captures only immutable outbound request facts before HttpClient disposes a request.</summary>
    private sealed record ProviderRequest(HttpMethod Method, Uri Uri, Dictionary<string, string[]> Headers);

    /// <summary>Controls the real adapter's HTTP boundary without replacing its request or response logic.</summary>
    private sealed class ProviderHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond) : HttpMessageHandler
    {
        public ConcurrentQueue<ProviderRequest> Requests { get; } = new();

        /// <inheritdoc />
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Enqueue(new ProviderRequest(request.Method, request.RequestUri!, request.Headers.ToDictionary(
                header => header.Key, header => header.Value.ToArray(), StringComparer.OrdinalIgnoreCase)));
            return respond(request, cancellationToken);
        }
    }

    /// <summary>Runs an isolated real MVC and mediator host on an ephemeral loopback port.</summary>
    private sealed class LookupHost : IAsyncDisposable
    {
        public WebApplication App { get; }
        public HttpClient Client { get; }

        /// <summary>Creates the HTTP client after Kestrel chooses its isolated port.</summary>
        private LookupHost(WebApplication app)
        {
            App = app;
            string address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
            Client = new HttpClient { BaseAddress = new Uri(address) };
        }

        /// <summary>Registers production controller, query and adapter with only the external provider substituted.</summary>
        public static async Task<LookupHost> CreateAsync(ProviderHandler provider, string? key = FakeServiceKey)
        {
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
            builder.Configuration.Sources.Clear();
            builder.Configuration.AddInMemoryCollection(new Dictionary<string, string?> { ["Neshan:ServiceApiKey"] = key });
            builder.Logging.ClearProviders();
            builder.WebHost.ConfigureKestrel(options => options.Listen(IPAddress.Loopback, 0));
            builder.Services.AddMediatR(config => config.RegisterServicesFromAssemblyContaining<ReverseGeocode.Query>());
            builder.Services.AddControllers().AddApplicationPart(typeof(AccountController).Assembly);
            builder.Services.AddHttpClient<IAddressGeocoder, NeshanAddressGeocoder>(client =>
            {
                client.BaseAddress = new Uri("https://api.neshan.org/");
                client.Timeout = TimeSpan.FromSeconds(8);
            }).ConfigurePrimaryHttpMessageHandler(() => provider);
            builder.Services.AddAuthentication("Test").AddScheme<AuthenticationSchemeOptions, TestAuthenticationHandler>("Test", _ => { });
            builder.Services.AddAuthorization();
            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();
            await app.StartAsync();
            return new LookupHost(app);
        }

        /// <summary>Creates a customer client without changing the host's anonymous client.</summary>
        public HttpClient CreateAuthenticatedClient()
        {
            var client = new HttpClient { BaseAddress = Client.BaseAddress };
            client.DefaultRequestHeaders.Add("Test-User", "11111111-1111-1111-1111-111111111111");
            return client;
        }

        /// <summary>Stops the isolated host and disposes its HTTP resources.</summary>
        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await App.StopAsync();
            await App.DisposeAsync();
        }
    }

    /// <summary>Authenticates explicit test customer identities without accessing production authentication.</summary>
    private sealed class TestAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        /// <summary>Creates the test scheme using standard framework dependencies.</summary>
        public TestAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
            : base(options, logger, encoder) { }

        /// <inheritdoc />
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Guid.TryParse(Request.Headers["Test-User"].ToString(), out var userId))
                return Task.FromResult(AuthenticateResult.NoResult());
            var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, userId.ToString()), new Claim(ClaimTypes.Role, "Customer") }, Scheme.Name);
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name)));
        }
    }
}
