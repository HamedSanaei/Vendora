using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Encodings.Web;
using API.Controllers;
using Application.Catalog;
using Application.Interfaces;
using Application.Products;
using Domain.Entities;
using Infrastructure.Content;
using Infrastructure.Storage;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Persistence;
using Persistence.Common;
using Persistence.Products;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Verifies product article safety, long-form persistence, image upload authorization, and legacy compatibility.</summary>
public sealed class ProductArticleTests
{
    private const string ImageUrl = "/uploads/products/0123456789abcdef0123456789abcdef.png";
    private readonly ProductDescriptionService _descriptions = new();

    /// <summary>Preserves supported formatting, finite font styles, links, lists, and owned image references.</summary>
    [Fact]
    public void Sanitizer_PreservesArticleFormatting()
    {
        string html = $"<h2>معرفی کیف</h2><p dir='rtl'><strong>مقاوم</strong> <em>سبک</em> <u>زیبا</u> <s>قدیمی</s> " +
            "<span style='font-family: Vazirmatn; font-size: 24px; color: #006b4f'>عنوان</span></p>" +
            $"<ul><li>اول</li></ul><ol><li>دوم</li></ol><blockquote>توضیح</blockquote><img src='{ImageUrl}' alt='نمای کیف'>" +
            "<p><a href='https://example.com'>لینک</a></p>";
        string safe = _descriptions.Sanitize(html)!;
        Assert.Contains("<h2>", safe);
        Assert.Contains("<strong>", safe);
        Assert.Contains("font-family: Vazirmatn", safe);
        Assert.Contains("font-size: 24px", safe);
        Assert.Contains("<ol>", safe);
        Assert.Contains(ImageUrl, safe);
        Assert.Contains("loading=\"lazy\"", safe);
        Assert.Contains("noopener noreferrer", safe);
        Assert.Equal(safe, _descriptions.Sanitize(safe));
    }

    /// <summary>Rejects executable markup, remote tracking images, dangerous links, and layout-breaking CSS.</summary>
    [Theory]
    [InlineData("<p onclick='alert(1)'>safe</p><script>alert(1)</script>", "onclick")]
    [InlineData("<p>safe</p><img src='https://tracker.test/x.png' onerror='alert(1)'>", "tracker.test")]
    [InlineData("<p>safe</p><img src='data:image/svg+xml,test'>", "data:")]
    [InlineData("<p>safe</p><img src='/uploads/products/../../file.png'>", "file.png")]
    [InlineData("<p><a href='javascript:alert(1)'>safe</a></p>", "javascript:")]
    [InlineData("<p><a href='//tracker.test'>safe</a></p>", "tracker.test")]
    [InlineData("<p style='position:fixed; z-index:9999; font-size:999px'>safe</p>", "999")]
    [InlineData("<p style='font-family:evil; background-image:url(https://tracker.test/x)'>safe</p>", "tracker.test")]
    [InlineData("<p>safe</p><iframe src='https://tracker.test'></iframe><form><input></form>", "iframe")]
    public void Sanitizer_RemovesUnsafeContent(string html, string forbidden)
    {
        string safe = _descriptions.Sanitize(html)!;
        Assert.Contains("safe", safe);
        Assert.DoesNotContain(forbidden, safe, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<script", safe, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("onerror", safe, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>Existing plain descriptions retain literal text and newlines; summaries do not contain markup.</summary>
    [Fact]
    public void LegacyTextAndExcerpts_AreCompatible()
    {
        const string plain = "دوام & زیبایی\nقیمت 2 < 3";
        Assert.Equal(plain, _descriptions.Sanitize(plain));
        Assert.Equal("اول دوم سوم", _descriptions.Excerpt("<p>اول</p><p><strong>دوم</strong></p><ul><li>سوم</li></ul>"));
        Assert.True(_descriptions.Excerpt("<p>" + new string('x', 1000) + "</p>")!.Length <= 321);
        Assert.Null(_descriptions.Sanitize("<p><br></p>"));
    }

    /// <summary>Upload authorization is enforced on the server, independently of frontend visibility.</summary>
    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("Customer", HttpStatusCode.Forbidden)]
    public async Task ArticleImages_RequireAdmin(string? role, HttpStatusCode expected)
    {
        await using var host = await ArticleHost.CreateAsync();
        using var client = host.Client(role);
        using var body = ImageBody(Png(), "image.png", "image/png");
        Assert.Equal(expected, (await client.PostAsync("/api/admin/products/description-images", body)).StatusCode);
    }

    /// <summary>Stores a real image and rejects extension/MIME/signature mismatch and oversized uploads.</summary>
    [Fact]
    public async Task ArticleImages_ValidateAndStoreRasterFiles()
    {
        await using var host = await ArticleHost.CreateAsync();
        using var client = host.Client("Admin");
        using var body = ImageBody(Png(), "../../image.png", "image/png");
        var response = await client.PostAsync("/api/admin/products/description-images", body);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        string url = (await response.Content.ReadFromJsonAsync<Dictionary<string, string>>())!["url"];
        Assert.Matches(@"^/uploads/products/[a-f0-9]{32}\.png$", url);
        Assert.Equal(Png(), await File.ReadAllBytesAsync(Path.Combine(host.Root, "wwwroot", url.TrimStart('/'))));
        using var fake = ImageBody(System.Text.Encoding.UTF8.GetBytes("<script>alert(1)</script>"), "fake.png", "image/png");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/admin/products/description-images", fake)).StatusCode);
        using var mismatch = ImageBody(Png(), "file.jpg", "image/jpeg");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/admin/products/description-images", mismatch)).StatusCode);
        using var oversized = ImageBody(new byte[5 * 1024 * 1024 + 1], "large.png", "image/png");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/admin/products/description-images", oversized)).StatusCode);
    }

    /// <summary>A long article round-trips through real create/edit/read APIs while lists stay compact and drafts stay private.</summary>
    [Fact]
    public async Task Article_RoundTripsWithoutBloatedCatalogLists()
    {
        await using var host = await ArticleHost.CreateAsync();
        using var client = host.Client("Admin");
        string article = "<h2>توضیحات</h2><p><strong>" + new string('ب', 6000) + "</strong></p><script>alert(1)</script>";
        using var body = ProductBody(article, host.CategoryId);
        var created = await client.PostAsync("/api/admin/products", body);
        Assert.True(created.StatusCode == HttpStatusCode.Created, await created.Content.ReadAsStringAsync());
        var product = (await created.Content.ReadFromJsonAsync<Application.Products.DTOs.AdminProductDto>())!;
        Assert.True(product.Description!.Length > 4000);
        Assert.DoesNotContain("<script", product.Description);
        var detail = (await client.GetFromJsonAsync<CatalogQueries.CatalogProductDto>($"/api/catalog/products/{product.Id}"))!;
        Assert.Equal(product.Description, detail.DescriptionHtml);
        Assert.True(detail.Description!.Length <= 321);
        var list = (await client.GetFromJsonAsync<CatalogQueries.CatalogProductDto[]>("/api/catalog/products"))!;
        Assert.Null(Assert.Single(list).DescriptionHtml);
        Assert.DoesNotContain("<", list[0].Description!);
        Assert.Equal(product.Description, (await client.GetFromJsonAsync<Application.Products.DTOs.AdminProductDto>($"/api/admin/products/{product.Id}"))!.Description);

        using var edited = ProductBody("<h3>جدید</h3><ul><li>کیف روزمره</li></ul>", host.CategoryId);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsync($"/api/admin/products/{product.Id}", edited)).StatusCode);
        var bySlug = (await client.GetFromJsonAsync<CatalogQueries.CatalogProductDto>("/api/catalog/products/article-test"))!;
        Assert.Contains("<ul>", bySlug.DescriptionHtml!);

        using var tooLong = ProductBody(new string('x', Product.MaxDescriptionLength + 1), host.CategoryId);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsync($"/api/admin/products/{product.Id}", tooLong)).StatusCode);
        using var expandsAfterEncoding = ProductBody("<p>" + new string('&', 50_000) + "</p>", host.CategoryId);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsync($"/api/admin/products/{product.Id}", expandsAfterEncoding)).StatusCode);
        using var scope = host.App.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        (await db.Products.FindAsync(product.Id))!.Status = Domain.Enums.ProductStatus.Draft;
        await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/catalog/products/{product.Id}")).StatusCode);
    }

    /// <summary>Builds an isolated multipart product, never touching real catalog data.</summary>
    private static MultipartFormDataContent ProductBody(string article, Guid categoryId)
    {
        var body = new MultipartFormDataContent();
        foreach (var (key, value) in new[] { ("title", "Article test"), ("slug", "article-test"), ("description", article),
            ("price", "250000"), ("stockQuantity", "4"), ("status", "Active"), ("categoryId", categoryId.ToString()) }) body.Add(new StringContent(value), key);
        return body;
    }

    /// <summary>Builds a single multipart image request.</summary>
    private static MultipartFormDataContent ImageBody(byte[] bytes, string name, string contentType)
    {
        var body = new MultipartFormDataContent();
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        body.Add(content, "file", name);
        return body;
    }

    /// <summary>Returns a valid one-pixel PNG fixture.</summary>
    private static byte[] Png() => Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6N2QAAAAASUVORK5CYII=");

    /// <summary>Hosts the actual controllers with isolated SQLite and a temporary upload root.</summary>
    internal sealed class ArticleHost(WebApplication app, SqliteConnection connection, string root, Guid categoryId) : IAsyncDisposable
    {
        public WebApplication App => app;
        public string Root => root;
        public Guid CategoryId => categoryId;

        /// <summary>Creates and migrates an empty test-only database.</summary>
        public static async Task<ArticleHost> CreateAsync(Action<IServiceCollection>? configure = null)
        {
            string root = Path.Combine(Path.GetTempPath(), "vendora-article-tests", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Path.Combine(root, "wwwroot"));
            var connection = new SqliteConnection("Data Source=:memory:");
            await connection.OpenAsync();
            var builder = WebApplication.CreateBuilder(new WebApplicationOptions { ContentRootPath = root,
                WebRootPath = Path.Combine(root, "wwwroot"), EnvironmentName = "Testing" });
            builder.Logging.ClearProviders();
            builder.WebHost.ConfigureKestrel(options => options.Listen(IPAddress.Loopback, 0));
            builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(connection));
            builder.Services.AddScoped<IProductAdminRepository, ProductAdminRepository>();
            builder.Services.AddScoped<IProductReadRepository, ProductReadRepository>();
            builder.Services.AddScoped<Persistence.Admin.IAdminRepository, Persistence.Admin.AdminRepository>();
            builder.Services.AddSingleton<Application.Seo.SeoAiRateGate>();
            builder.Services.AddSingleton<ISeoAiGateway, UnconfiguredSeoGateway>();
            builder.Services.AddScoped<IUnitOfWork>(services => services.GetRequiredService<AppDbContext>());
            builder.Services.AddScoped<IProductDescriptionService, ProductDescriptionService>();
            builder.Services.AddScoped<IEnamadCodeParser, EnamadCodeParser>();
            builder.Services.AddSingleton(TimeProvider.System);
            builder.Services.AddScoped<IProductImageStorage, LocalProductImageStorage>();
            builder.Services.AddMediatR(config => config.RegisterServicesFromAssemblyContaining<UploadDescriptionImage.Command>());
            builder.Services.AddControllers().AddApplicationPart(typeof(AdminController).Assembly);
            builder.Services.AddAuthentication("Test").AddScheme<AuthenticationSchemeOptions, ArticleAuth>("Test", _ => { });
            builder.Services.AddAuthorization(options => options.AddPolicy("AdminOnly", policy => policy.RequireRole("Admin")));
            API.DiscussionRateLimiting.AddDiscussionRateLimiting(builder.Services);
            configure?.Invoke(builder.Services);
            var app = builder.Build();
            app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter(); app.MapControllers();
            var category = new Category { Name = "Test bags", Slug = "test-bags", IsActive = true };
            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await db.Database.MigrateAsync();
                db.Categories.Add(category);
                await db.SaveChangesAsync();
            }
            await app.StartAsync();
            return new(app, connection, root, category.Id);
        }

        /// <summary>Creates a request client with explicit test-only authorization.</summary>
        public HttpClient Client(string? role)
        {
            var address = app.Services.GetRequiredService<IServer>().Features.Get<IServerAddressesFeature>()!.Addresses.Single();
            var client = new HttpClient { BaseAddress = new Uri(address) };
            if (role is not null) client.DefaultRequestHeaders.Add("Test-Role", role);
            return client;
        }

        /// <inheritdoc />
        public async ValueTask DisposeAsync()
        {
            await app.StopAsync(); await app.DisposeAsync(); await connection.DisposeAsync();
            // Only the GUID-named directory created above belongs to this fixture.
            Directory.Delete(root, recursive: true);
        }
    }

    /// <summary>Test hosts never invoke an external AI provider or carry a real credential.</summary>
    private sealed class UnconfiguredSeoGateway : ISeoAiGateway
    {
        public bool IsConfigured => false;
        public Task<IReadOnlyList<string>> GetModelsAsync(CancellationToken ct) => Task.FromResult<IReadOnlyList<string>>([]);
        public Task<SeoAiSuggestion> SuggestAsync(string operation, Application.Seo.SeoDraft draft, CancellationToken ct)
            => throw new InvalidOperationException("No AI provider in the isolated test host.");
    }

    /// <summary>Authenticates test headers only in this isolated test host, never in the production pipeline.</summary>
    private sealed class ArticleAuth(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
        : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
    {
        /// <inheritdoc />
        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            string role = Request.Headers["Test-Role"].ToString();
            if (role is not ("Admin" or "Customer")) return Task.FromResult(AuthenticateResult.NoResult());
            var subject = Request.Headers["Test-User"].ToString();
            var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, string.IsNullOrEmpty(subject) ? "article-test" : subject), new Claim(ClaimTypes.Role, role)], Scheme.Name);
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), Scheme.Name)));
        }
    }
}
