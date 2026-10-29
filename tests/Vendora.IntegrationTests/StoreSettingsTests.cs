using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using API.Controllers;
using Application.Interfaces;
using Application.StoreSettings;
using Domain.Entities;
using Infrastructure.Content;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Verifies defaults, compatibility, authorization, inert badge parsing and atomic upload failure behavior.</summary>
public sealed class StoreSettingsTests
{
    private const string Badge = "<a href='https://trustseal.enamad.ir/?id=123&amp;Code=abc' target='_blank'><img referrerpolicy='origin' src='https://trustseal.enamad.ir/logo.aspx?id=123&amp;Code=abc' /></a>";
    private static readonly byte[] Png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6N2QAAAAASUVORK5CYII=");

    /// <summary>Visibility round-trips independently of the retained badge and other presentation settings.</summary>
    [Fact]
    public async Task EnamadVisibility_ToggleAndReload_RetainsBadgeAndIdentity()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var admin = host.Client("Admin"); using var guest = host.Client(null);
        var profile = new StoreProfile { NameFa = "فروشگاه من", Phone = "02112345678" };
        EnamadBadge? originalBadge = null;
        foreach (bool enabled in new[] { true, false, true, false })
        {
            using var form = Form(new(profile with { EnamadEnabled = enabled }, Badge));
            (await admin.PutAsync("/api/admin/store-settings", form)).EnsureSuccessStatusCode();
            profile = (await admin.GetFromJsonAsync<StoreProfile>("/api/admin/store-settings"))!;
            originalBadge ??= profile.Enamad;
            Assert.NotNull(originalBadge);
            Assert.Equal(enabled, profile.EnamadEnabled);
            Assert.Equal(originalBadge, profile.Enamad);
            Assert.Equal("فروشگاه من", profile.NameFa);
            Assert.Equal("02112345678", profile.Phone);
            Assert.Equal(profile, await guest.GetFromJsonAsync<StoreProfile>("/api/store-settings"));
        }
    }

    /// <summary>The exact homepage title round-trips through existing JSON settings without replacing identity or technical SEO.</summary>
    [Fact]
    public async Task HomepageTitle_SaveTrimClear_AndRejectTooLongWithoutMutation()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var admin = host.Client("Admin"); using var guest = host.Client(null);
        using var form = Form(new(new StoreProfile { NameFa = "وندورا", HomeTitleFa = "  فروشگاه کیف وندورا | خرید مستقیم  " }));
        (await admin.PutAsync("/api/admin/store-settings", form)).EnsureSuccessStatusCode();
        var saved = (await guest.GetFromJsonAsync<StoreProfile>("/api/store-settings"))!;
        Assert.Equal("فروشگاه کیف وندورا | خرید مستقیم", saved.HomeTitleFa);
        var seo = (await guest.GetFromJsonAsync<SiteSeoDto>("/api/catalog/seo"))!;
        Assert.Equal("وندورا", seo.SiteName); Assert.Equal("{title} | {siteName}", seo.TitleTemplate);
        using var tooLong = Form(new(saved with { HomeTitleFa = new string('x', 151) }));
        using var rejected = await admin.PutAsync("/api/admin/store-settings", tooLong);
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        Assert.Contains("homeTitleFa", await rejected.Content.ReadAsStringAsync());
        Assert.Equal(saved, await guest.GetFromJsonAsync<StoreProfile>("/api/store-settings"));
        using var boundary = Form(new(saved with { HomeTitleFa = new string('x', 150) }));
        (await admin.PutAsync("/api/admin/store-settings", boundary)).EnsureSuccessStatusCode();
        Assert.Equal(150, (await guest.GetFromJsonAsync<StoreProfile>("/api/store-settings"))!.HomeTitleFa!.Length);
        using var clear = Form(new(saved with { HomeTitleFa = "  " }));
        (await admin.PutAsync("/api/admin/store-settings", clear)).EnsureSuccessStatusCode();
        Assert.Null((await guest.GetFromJsonAsync<StoreProfile>("/api/store-settings"))!.HomeTitleFa);
    }

    /// <summary>Reading an unconfigured installation preserves the existing singleton and returns empty presentation overrides.</summary>
    [Fact]
    public async Task Defaults_Save_AndReset_PreserveTechnicalSeo()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var anonymous = host.Client(null); using var admin = host.Client("Admin");
        var original = (await anonymous.GetFromJsonAsync<StoreProfile>("/api/store-settings"))!;
        Assert.Equal(new StoreProfile(), original);
        using (var scope = host.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var settings = await db.SeoSettings.SingleAsync();
            settings.SiteUrl = "https://example.com"; settings.TitleTemplate = "{title} — {siteName}"; settings.IsIndexingEnabled = true;
            await db.SaveChangesAsync();
        }
        using var form = Form(new(new StoreProfile { NameFa = " برند من ", NameEn = "My brand", Phone = "+۹۸ ۲۱ ۱۲۳۴", IntroFa = "تولیدی کیف", SocialProfiles = "https://instagram.com/test", EnamadEnabled = true }, Badge), true);
        using var saved = await admin.PutAsync("/api/admin/store-settings", form);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var result = (await saved.Content.ReadFromJsonAsync<StoreProfile>())!;
        Assert.Equal("برند من", result.NameFa); Assert.Equal("My brand", result.NameEn);
        Assert.Equal("+98 21 1234", result.Phone);
        Assert.NotNull(result.LogoUrl); Assert.NotNull(result.FaviconUrl); Assert.NotNull(result.Enamad);
        Assert.Equal(result, await anonymous.GetFromJsonAsync<StoreProfile>("/api/store-settings"));
        var seo = await anonymous.GetFromJsonAsync<SiteSeoDto>("/api/catalog/seo");
        Assert.Equal(result.NameFa, seo!.SiteName); Assert.Equal(result.LogoUrl, seo.LogoUrl); Assert.Equal(result.SocialProfiles, seo.SocialProfiles);
        // Reset is just a deliberate save of empty overrides; unrelated settings must survive.
        using var reset = Form(new(new StoreProfile()));
        using var resetResponse = await admin.PutAsync("/api/admin/store-settings", reset);
        Assert.Equal(HttpStatusCode.OK, resetResponse.StatusCode);
        Assert.Equal(original, await anonymous.GetFromJsonAsync<StoreProfile>("/api/store-settings"));
        seo = await anonymous.GetFromJsonAsync<SiteSeoDto>("/api/catalog/seo");
        Assert.Equal("وندورا", seo!.SiteName); Assert.Equal("https://example.com", seo.SiteUrl);
        Assert.Equal("{title} — {siteName}", seo.TitleTemplate); Assert.True(seo.IsIndexingEnabled);
    }

    /// <summary>Existing SEO API writes still update shared identity without discarding new localized fields.</summary>
    [Fact]
    public async Task LegacySeoWrites_ShareIdentityWithoutReplacingNewFields()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var admin = host.Client("Admin");
        using var form = Form(new(new StoreProfile { NameEn = "English brand", HoursFa = "۹ تا ۱۸" }));
        using var save = await admin.PutAsync("/api/admin/store-settings", form); save.EnsureSuccessStatusCode();
        using var seoSave = await admin.PutAsJsonAsync("/api/admin/seo/settings", new SiteSeoDto("نام جدید", "https://example.com", "{title} | {siteName}", false, LogoUrl: "https://example.com/logo.png", SocialProfiles: "https://instagram.com/new"));
        seoSave.EnsureSuccessStatusCode();
        var result = (await admin.GetFromJsonAsync<StoreProfile>("/api/admin/store-settings"))!;
        Assert.Equal("نام جدید", result.NameFa); Assert.Equal("English brand", result.NameEn);
        Assert.Equal("۹ تا ۱۸", result.HoursFa); Assert.Equal("https://example.com/logo.png", result.LogoUrl);
    }

    /// <summary>Both admin endpoints use the established role policy.</summary>
    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("Customer", HttpStatusCode.Forbidden)]
    public async Task AdminEndpoints_RequireAdmin(string? role, HttpStatusCode expected)
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var client = host.Client(role); using var form = Form(new(new StoreProfile()));
        using var get = await client.GetAsync("/api/admin/store-settings");
        using var put = await client.PutAsync("/api/admin/store-settings", form);
        Assert.Equal(expected, get.StatusCode); Assert.Equal(expected, put.StatusCode);
    }

    /// <summary>Invalid fields and untrusted file declarations cannot alter persisted settings or create files.</summary>
    [Theory]
    [InlineData("email")]
    [InlineData("social")]
    [InlineData("badge")]
    [InlineData("signature")]
    [InlineData("mime")]
    [InlineData("size")]
    [InlineData("icon")]
    [InlineData("url")]
    public async Task InvalidInput_IsRejectedBeforeMutation(string invalid)
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var admin = host.Client("Admin");
        var profile = new StoreProfile { NameFa = "unchanged", Email = invalid == "email" ? "bad" : null,
            SocialProfiles = invalid == "social" ? "javascript:alert(1)" : null,
            EnamadEnabled = invalid == "badge", LogoUrl = invalid == "url" ? "/uploads/products/other.png" : null };
        using var form = Form(new(profile, invalid == "badge" ? "<script>alert(1)</script>" : null));
        if (invalid is "signature" or "mime" or "size" or "icon")
        {
            var file = new ByteArrayContent(invalid == "signature" ? "<html>fake</html>"u8.ToArray() : invalid == "size" ? new byte[5 * 1024 * 1024 + 1] : Png);
            file.Headers.ContentType = new(invalid == "mime" || invalid == "icon" ? "image/jpeg" : "image/png");
            form.Add(file, invalid == "icon" ? "favicon" : "logo", invalid == "icon" ? "icon.jpg" : "logo.png");
        }
        using var response = await admin.PutAsync("/api/admin/store-settings", form);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(new StoreProfile(), await admin.GetFromJsonAsync<StoreProfile>("/api/admin/store-settings"));
        Assert.Empty(Directory.GetFiles(Path.Combine(host.Root, "wwwroot"), "*", SearchOption.AllDirectories));
    }

    /// <summary>Only official HTTPS link/image pairs survive; executable attributes are never part of normalized output.</summary>
    [Fact]
    public void BadgeParsing_DoesNotReturnExecutableMarkup()
    {
        var parser = new EnamadCodeParser();
        Assert.Equal(new EnamadBadge("https://trustseal.enamad.ir/?id=123&Code=abc", "https://trustseal.enamad.ir/logo.aspx?id=123&Code=abc"), parser.Parse(Badge));
        Assert.NotNull(parser.Parse(Badge.Replace("<img ", "<img onerror='alert(1)' ")));
        foreach (string invalid in new[] { Badge + "<script>alert(1)</script>", Badge.Replace("trustseal.enamad.ir", "trustseal.enamad.ir.evil.com"), Badge.Replace("https://", "javascript:"), Badge.Replace("https://", "http://"), Badge.Replace("https://trustseal", "https://user@trustseal"), Badge + Badge }) Assert.Null(parser.Parse(invalid));
    }

    /// <summary>A failing database commit cleans both new uploads and keeps the previously committed configuration.</summary>
    [Fact]
    public async Task FailedSave_RollsBackNewUploads()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        var failure = new SaveFailure();
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).AddInterceptors(failure).Options;
        await using var db = new AppDbContext(options); await db.Database.EnsureCreatedAsync();
        var row = await db.SeoSettings.SingleAsync(); row.SiteName = "Original"; await db.SaveChangesAsync();
        var storage = new RecordingStorage(); failure.Fail = true;
        var image = new ProductImageUpload("logo.png", "image/png", Png.Length, () => new MemoryStream(Png));
        await Assert.ThrowsAsync<DbUpdateException>(() => new StoreSettingsUseCases.CommandHandler(db, storage, new EnamadCodeParser())
            .Handle(new(new(new StoreProfile { NameFa = "Replacement" }), image, image), CancellationToken.None));
        Assert.Empty(storage.Files); Assert.Equal(2, storage.Deleted);
        db.ChangeTracker.Clear(); Assert.Equal("Original", (await db.SeoSettings.SingleAsync()).SiteName);
    }

    /// <summary>Creates actual multipart requests, optionally containing both supported image uploads.</summary>
    private static MultipartFormDataContent Form(StoreSettingsInput input, bool images = false)
    {
        var form = new MultipartFormDataContent(); form.Add(new StringContent(JsonSerializer.Serialize(input, new JsonSerializerOptions(JsonSerializerDefaults.Web))), "settings");
        if (images) foreach (string name in new[] { "logo", "favicon" })
        {
            var file = new ByteArrayContent(Png); file.Headers.ContentType = new MediaTypeHeaderValue("image/png"); form.Add(file, name, name + ".png");
        }
        return form;
    }

    /// <summary>Injects a deterministic commit failure after the upload phase.</summary>
    private sealed class SaveFailure : SaveChangesInterceptor
    {
        public bool Fail { get; set; }
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
            => Fail ? throw new DbUpdateException("Deliberate settings save failure") : ValueTask.FromResult(result);
    }

    /// <summary>Tracks only this use case's generated uploads so compensation is directly observable.</summary>
    private sealed class RecordingStorage : IProductImageStorage
    {
        public HashSet<string> Files { get; } = []; public int Deleted { get; private set; }
        public Task<StoredProductImage> SaveAsync(ProductImageUpload upload, CancellationToken cancellationToken = default)
        {
            string url = $"/uploads/products/{Guid.NewGuid():N}.png"; Files.Add(url); return Task.FromResult(new StoredProductImage(url));
        }
        public Task DeleteAsync(string imageUrl, CancellationToken cancellationToken = default) { Files.Remove(imageUrl); Deleted++; return Task.CompletedTask; }
    }
}
