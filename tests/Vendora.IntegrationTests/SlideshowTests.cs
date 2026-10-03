using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using API.Controllers;
using Application.Interfaces;
using Application.Slideshow;
using Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Persistence;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Exercises real slideshow HTTP authorization, persistence, validation, and local image lifecycle.</summary>
public sealed class SlideshowTests
{
    private static readonly byte[] Png = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6N2QAAAAASUVORK5CYII=");

    /// <summary>Public reads are empty initially and retain deterministic ordering across independent requests.</summary>
    [Fact]
    public async Task PublicPlaylist_IsPersistentAndSortedByOrderThenId()
    {
        await using var host = await SlideshowHost.CreateAsync();
        Assert.Empty((await host.Client.GetFromJsonAsync<SlideshowSlideDto[]>("/api/slideshow"))!);
        using var admin = host.CreateClient("Admin");
        var first = await CreateAsync(admin, 4, 120);
        var second = await CreateAsync(admin, 0, 1);
        var third = await CreateAsync(admin, 4, 9);

        var slides = (await host.Client.GetFromJsonAsync<SlideshowSlideDto[]>("/api/slideshow"))!;
        Assert.Equal(new[] { first, second, third }.OrderBy(s => s.SortOrder).ThenBy(s => s.Id), slides);
        Assert.Equal(slides, (await admin.GetFromJsonAsync<SlideshowSlideDto[]>("/api/admin/slideshow"))!);
        Assert.All(slides, slide => Assert.StartsWith("/uploads/products/", slide.ImageUrl));
        using var scope = host.App.Services.CreateScope();
        Assert.Equal(3, await scope.ServiceProvider.GetRequiredService<AppDbContext>().SlideshowSlides.CountAsync());
    }

    /// <summary>All four admin verbs require Admin while public reads remain anonymous.</summary>
    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("Customer", HttpStatusCode.Forbidden)]
    public async Task AdminManagement_RejectsAnonymousAndNonAdmin(string? role, HttpStatusCode expected)
    {
        await using var host = await SlideshowHost.CreateAsync();
        using var client = host.CreateClient(role);
        string itemPath = $"/api/admin/slideshow/{Guid.NewGuid()}";
        using var get = await client.GetAsync("/api/admin/slideshow");
        using var postForm = Form(0, 5);
        using var post = await client.PostAsync("/api/admin/slideshow", postForm);
        using var putForm = Form(0, 5);
        using var put = await client.PutAsync(itemPath, putForm);
        using var delete = await client.DeleteAsync(itemPath);
        Assert.Equal(expected, get.StatusCode);
        Assert.Equal(expected, post.StatusCode);
        Assert.Equal(expected, put.StatusCode);
        Assert.Equal(expected, delete.StatusCode);
        using var publicRead = await client.GetAsync("/api/slideshow");
        Assert.Equal(HttpStatusCode.OK, publicRead.StatusCode);
    }

    /// <summary>Invalid ranges are rejected before any file or record is created.</summary>
    [Theory]
    [InlineData(-1, 5)]
    [InlineData(0, 0)]
    [InlineData(0, 121)]
    public async Task InvalidSettings_AreRejectedAtHttpAndUseCaseBoundaries(int sortOrder, int duration)
    {
        await using var host = await SlideshowHost.CreateAsync();
        using var admin = host.CreateClient("Admin");
        using var form = Form(sortOrder, duration, Png);
        using var response = await admin.PostAsync("/api/admin/slideshow", form);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var scope = host.App.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storage = scope.ServiceProvider.GetRequiredService<IProductImageStorage>();
        var outcome = await new SlideshowSlides.Create.Handler(db, storage).Handle(
            new SlideshowSlides.Create.Command(Upload(Png), sortOrder, duration), CancellationToken.None);
        Assert.Equal(SlideshowSlides.Failure.Validation, outcome.Failure);
        Assert.Empty(await db.SlideshowSlides.ToListAsync());
        Assert.Empty(host.UploadedFiles());
    }

    /// <summary>Required integer fields reject missing, fractional and nonnumeric multipart values.</summary>
    [Theory]
    [InlineData(null, "5")]
    [InlineData("0", null)]
    [InlineData("0.5", "5")]
    [InlineData("0", "1.5")]
    [InlineData("zero", "5")]
    public async Task MultipartSettings_RequireIntegers(string? order, string? duration)
    {
        await using var host = await SlideshowHost.CreateAsync();
        using var admin = host.CreateClient("Admin");
        using var form = new MultipartFormDataContent();
        if (order is not null) form.Add(new StringContent(order), "sortOrder");
        if (duration is not null) form.Add(new StringContent(duration), "durationSeconds");
        using var response = await admin.PostAsync("/api/admin/slideshow", form);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(host.UploadedFiles());
    }

    /// <summary>Untrusted MIME, extension, signature, missing, empty and oversize files never reach storage.</summary>
    [Theory]
    [InlineData("missing")]
    [InlineData("empty")]
    [InlineData("oversize")]
    [InlineData("signature")]
    [InlineData("extension")]
    [InlineData("mime")]
    public async Task InvalidImages_AreRejectedWithoutOrphans(string invalidCase)
    {
        await using var host = await SlideshowHost.CreateAsync();
        using var admin = host.CreateClient("Admin");
        byte[]? bytes = invalidCase switch
        {
            "missing" => null,
            "empty" => [],
            "oversize" => new byte[5 * 1024 * 1024 + 1],
            "signature" => "<html>not an image</html>"u8.ToArray(),
            _ => Png
        };
        using var form = Form(0, 5, bytes,
            invalidCase == "extension" ? "photo.svg" : "photo.png",
            invalidCase == "mime" ? "image/jpeg" : "image/png");
        using var response = await admin.PostAsync("/api/admin/slideshow", form);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty((await host.Client.GetFromJsonAsync<SlideshowSlideDto[]>("/api/slideshow"))!);
        Assert.Empty(host.UploadedFiles());
    }

    /// <summary>Omitted replacement retains the image; valid replacement and deletion clean only that slide's files.</summary>
    [Fact]
    public async Task EditingAndDeleting_ManagePersistedPhotosAndKeepUnrelatedSlides()
    {
        await using var host = await SlideshowHost.CreateAsync();
        using var admin = host.CreateClient("Admin");
        var slide = await CreateAsync(admin, 0, 5);
        var unrelated = await CreateAsync(admin, 1, 6);
        string originalPath = host.LocalPath(slide.ImageUrl);
        using var settings = Form(3, 10);
        using var settingsResponse = await admin.PutAsync($"/api/admin/slideshow/{slide.Id}", settings);
        Assert.Equal(HttpStatusCode.OK, settingsResponse.StatusCode);
        var edited = (await settingsResponse.Content.ReadFromJsonAsync<SlideshowSlideDto>())!;
        Assert.Equal(slide.ImageUrl, edited.ImageUrl);
        Assert.Equal(3, edited.SortOrder);
        Assert.Equal(10, edited.DurationSeconds);
        Assert.True(File.Exists(originalPath));

        using var invalid = Form(0, 0, Png);
        using var invalidResponse = await admin.PutAsync($"/api/admin/slideshow/{slide.Id}", invalid);
        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);
        using var replacement = Form(0, 1, Png);
        using var replacementResponse = await admin.PutAsync($"/api/admin/slideshow/{slide.Id}", replacement);
        Assert.Equal(HttpStatusCode.OK, replacementResponse.StatusCode);
        var replaced = (await replacementResponse.Content.ReadFromJsonAsync<SlideshowSlideDto>())!;
        Assert.NotEqual(slide.ImageUrl, replaced.ImageUrl);
        Assert.False(File.Exists(originalPath));
        Assert.True(File.Exists(host.LocalPath(replaced.ImageUrl)));

        using var deleted = await admin.DeleteAsync($"/api/admin/slideshow/{slide.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.False(File.Exists(host.LocalPath(replaced.ImageUrl)));
        Assert.Equal(new[] { unrelated }, (await host.Client.GetFromJsonAsync<SlideshowSlideDto[]>("/api/slideshow"))!);
        Assert.True(File.Exists(host.LocalPath(unrelated.ImageUrl)));
        using var missingDelete = await admin.DeleteAsync($"/api/admin/slideshow/{slide.Id}");
        using var missingForm = Form(0, 5, Png);
        using var missingEdit = await admin.PutAsync($"/api/admin/slideshow/{slide.Id}", missingForm);
        Assert.Equal(HttpStatusCode.NotFound, missingDelete.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, missingEdit.StatusCode);
        Assert.Single(host.UploadedFiles());
    }

    /// <summary>A failed database write removes the newly uploaded file while preserving the original replacement.</summary>
    [Fact]
    public async Task PersistenceFailure_DoesNotOrphanNewUploadsOrRemoveOriginal()
    {
        await using var host = await SlideshowHost.CreateAsync();
        using var admin = host.CreateClient("Admin");
        var existing = await CreateAsync(admin, 0, 5);
        using (var scope = host.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var storage = scope.ServiceProvider.GetRequiredService<IProductImageStorage>();
            host.SaveFailure.FailNextSave = true;
            await Assert.ThrowsAsync<DbUpdateException>(() => new SlideshowSlides.Create.Handler(db, storage).Handle(
                new SlideshowSlides.Create.Command(Upload(Png), 1, 10), CancellationToken.None));
            Assert.Single(host.UploadedFiles());
            host.SaveFailure.FailNextSave = true;
            await Assert.ThrowsAsync<DbUpdateException>(() => new SlideshowSlides.Edit.Handler(db, storage).Handle(
                new SlideshowSlides.Edit.Command(existing.Id, Upload(Png), 2, 15), CancellationToken.None));
        }
        Assert.Single(host.UploadedFiles());
        Assert.True(File.Exists(host.LocalPath(existing.ImageUrl)));
        Assert.Equal(new[] { existing }, (await host.Client.GetFromJsonAsync<SlideshowSlideDto[]>("/api/slideshow"))!);
    }

    /// <summary>Generated filenames ignore traversal-looking upload names and deletion refuses arbitrary paths.</summary>
    [Fact]
    public async Task Storage_UsesGeneratedNamesAndRefusesUnownedDeletion()
    {
        await using var host = await SlideshowHost.CreateAsync();
        using var scope = host.App.Services.CreateScope();
        var storage = scope.ServiceProvider.GetRequiredService<IProductImageStorage>();
        var stored = await storage.SaveAsync(Upload(Png, "../../outside.png"));
        Assert.True(Guid.TryParseExact(Path.GetFileNameWithoutExtension(stored.Url), "N", out _));
        string outside = Path.Combine(host.RootPath, "outside.png");
        await File.WriteAllBytesAsync(outside, Png);
        await storage.DeleteAsync("/uploads/products/../../../outside.png");
        await storage.DeleteAsync(outside);
        await storage.DeleteAsync("https://example.com/outside.png");
        Assert.True(File.Exists(outside));
        Assert.True(File.Exists(host.LocalPath(stored.Url)));
        await storage.DeleteAsync(stored.Url);
        Assert.False(File.Exists(host.LocalPath(stored.Url)));
    }

    /// <summary>Creates a valid slide through the real multipart endpoint.</summary>
    private static async Task<SlideshowSlideDto> CreateAsync(HttpClient client, int order, int duration)
    {
        using var form = Form(order, duration, Png);
        using var response = await client.PostAsync("/api/admin/slideshow", form);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SlideshowSlideDto>())!;
    }

    /// <summary>Builds multipart settings with an optional uploaded image.</summary>
    private static MultipartFormDataContent Form(int order, int duration, byte[]? bytes = null,
        string fileName = "photo.png", string contentType = "image/png")
    {
        var form = new MultipartFormDataContent();
        form.Add(new StringContent(order.ToString(CultureInfo.InvariantCulture)), "sortOrder");
        form.Add(new StringContent(duration.ToString(CultureInfo.InvariantCulture)), "durationSeconds");
        if (bytes is not null)
        {
            var image = new ByteArrayContent(bytes);
            image.Headers.ContentType = new MediaTypeHeaderValue(contentType);
            form.Add(image, "image", fileName);
        }
        return form;
    }

    /// <summary>Wraps image bytes for direct application/storage boundary tests.</summary>
    private static ProductImageUpload Upload(byte[] bytes, string fileName = "photo.png")
    {
        return new ProductImageUpload(fileName, "image/png", bytes.Length, () => new MemoryStream(bytes, writable: false));
    }

    /// <summary>Runs real MVC, mediator, SQLite and file storage on an ephemeral local HTTP port without new packages.</summary>
    private sealed class SlideshowHost : IAsyncDisposable
    {
        private readonly SqliteConnection _connection;
        public WebApplication App { get; }
        public HttpClient Client { get; }
        public string RootPath { get; }
        public FailSaveInterceptor SaveFailure { get; }

        private SlideshowHost(WebApplication app, SqliteConnection connection, string rootPath, FailSaveInterceptor saveFailure)
        {
            App = app;
            _connection = connection;
            RootPath = rootPath;
            SaveFailure = saveFailure;
            var server = app.Services.GetRequiredService<IServer>();
            string address = server.Features.Get<IServerAddressesFeature>()!.Addresses.Single();
            Client = new HttpClient { BaseAddress = new Uri(address) };
        }

        /// <summary>Creates an isolated in-memory database and temporary web root for one test.</summary>
        public static async Task<SlideshowHost> CreateAsync()
        {
            string root = Path.Combine(Path.GetTempPath(), "vendora-slideshow-tests", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Path.Combine(root, "wwwroot"));
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions
            {
                ContentRootPath = root,
                WebRootPath = Path.Combine(root, "wwwroot"),
                EnvironmentName = "Testing"
            });
            builder.Logging.ClearProviders();
            builder.WebHost.ConfigureKestrel(options => options.Listen(IPAddress.Loopback, 0));
            var interceptor = new FailSaveInterceptor();
            builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(connection).AddInterceptors(interceptor));
            builder.Services.AddScoped<IProductImageStorage, LocalProductImageStorage>();
            builder.Services.AddMediatR(config => config.RegisterServicesFromAssemblyContaining<SlideshowSlideDto>());
            builder.Services.AddControllers().AddApplicationPart(typeof(SlideshowController).Assembly);
            builder.Services.AddAuthentication("Test").AddScheme<AuthenticationSchemeOptions, TestAuthenticationHandler>("Test", _ => { });
            builder.Services.AddAuthorization(options => options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin")));
            var app = builder.Build();
            app.UseAuthentication();
            app.UseAuthorization();
            app.MapControllers();
            using (var scope = app.Services.CreateScope())
            {
                await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreatedAsync();
            }
            await app.StartAsync();
            return new SlideshowHost(app, connection, root, interceptor);
        }

        /// <summary>Creates an anonymous, customer or admin client to exercise the real authorization policy.</summary>
        public HttpClient CreateClient(string? role)
        {
            var client = new HttpClient { BaseAddress = Client.BaseAddress };
            if (role is not null) client.DefaultRequestHeaders.Add("Test-Role", role);
            return client;
        }

        /// <summary>Finds a stored image within this test's web root.</summary>
        public string LocalPath(string url) => Path.Combine(RootPath, "wwwroot", url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));

        /// <summary>Returns only files in this test's dedicated upload directory.</summary>
        public string[] UploadedFiles()
        {
            string directory = Path.Combine(RootPath, "wwwroot", "uploads", "products");
            return Directory.Exists(directory) ? Directory.GetFiles(directory) : [];
        }

        /// <summary>Stops the server and removes only this test's temporary resources.</summary>
        public async ValueTask DisposeAsync()
        {
            Client.Dispose();
            await App.StopAsync();
            await App.DisposeAsync();
            await _connection.DisposeAsync();
            Directory.Delete(RootPath, recursive: true);
        }
    }

    /// <summary>Provides a deterministic database write failure to exercise upload rollback cleanup.</summary>
    private sealed class FailSaveInterceptor : SaveChangesInterceptor
    {
        public bool FailNextSave { get; set; }

        /// <inheritdoc />
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData,
            InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (FailNextSave)
            {
                FailNextSave = false;
                throw new DbUpdateException("Deliberate persistence failure for upload cleanup coverage.");
            }
            return ValueTask.FromResult(result);
        }
    }

    /// <summary>Supplies test identities only; production authentication remains untouched.</summary>
    private sealed class TestAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        /// <summary>Creates the test-only authentication scheme using the standard framework services.</summary>
        public TestAuthenticationHandler(IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger, UrlEncoder encoder) : base(options, logger, encoder)
        {
        }

        /// <inheritdoc />
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            string role = Request.Headers["Test-Role"].ToString();
            if (role is not ("Admin" or "Customer")) return Task.FromResult(AuthenticateResult.NoResult());
            var identity = new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, "slideshow-test"), new Claim(ClaimTypes.Role, role) }, Scheme.Name);
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name)));
        }
    }
}
