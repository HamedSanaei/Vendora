using System.Net;
using System.Net.Http.Json;
using Application.Catalog;
using Application.Products.DTOs;
using Domain.Common;
using Domain.Entities;
using Domain.Enums;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
using Xunit;
using Host = Vendora.IntegrationTests.ProductArticleTests.ArticleHost;

namespace Vendora.IntegrationTests;

/// <summary>Validates durable code allocation, legacy migration and actual public/admin search contracts.</summary>
public sealed class ProductCodeTests
{
    /// <summary>Accepts the same complete product code in all three supported digit alphabets.</summary>
    [Theory]
    [InlineData("100", 100)]
    [InlineData(" ۱۰۰ ", 100)]
    [InlineData("١٠٠", 100)]
    [InlineData("10", null)]
    [InlineData("-100", null)]
    [InlineData("100 bag", null)]
    [InlineData("999999999999999999999", null)]
    public void ParsesOnlyValidCodes(string query, int? expected) => Assert.Equal(expected, ProductCodeSearch.Parse(query));

    /// <summary>Existing products retain their content/identifiers and receive permanent ordered codes from 100.</summary>
    [Fact]
    public async Task Migration_BackfillsLegacyProducts_AndContinuesTheSequence()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.GetService<IMigrator>().MigrateAsync("20261021060639_AddProductDiscussions");
        Guid first = Guid.NewGuid(), second = Guid.NewGuid();
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Products" ("Id", "Title", "Slug", "Price", "StockQuantity", "Status", "InventoryStatus", "CreatedAtUtc")
            VALUES ({first}, {"Original bag"}, {"seed-bestseller-city-tote"}, {250000m}, {2}, {1}, {1}, {new DateTime(2026, 1, 1)}),
                   ({second}, {"Archived bag"}, {"archived-bag"}, {350000m}, {0}, {2}, {0}, {new DateTime(2026, 1, 2)})
            """);
        await db.Database.MigrateAsync();
        var original = await db.Products.FindAsync(first);
        Assert.Equal(100, original!.ProductCode);
        Assert.Equal("seed-bestseller-city-tote", original.Slug);
        Assert.Equal(250000m, original.Price);
        Assert.Equal(101, (await db.Products.FindAsync(second))!.ProductCode);
        var added = Bag("new-bag");
        db.Products.Add(added);
        await db.SaveChangesAsync();
        Assert.Equal(102, added.ProductCode);
        await db.Database.MigrateAsync();
        Assert.Equal(100, (await db.Products.FindAsync(first))!.ProductCode);
    }

    /// <summary>Synchronous/asynchronous inserts, edits and hard deletion cannot recycle or change codes.</summary>
    [Fact]
    public async Task Codes_AreStable_AndDeletedCodesAreNeverReused()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.MigrateAsync();
        var first = Bag("first"); var second = Bag("second");
        db.AddRange(first, second); db.SaveChanges();
        Assert.Equal(new[] { 100, 101 }, new[] { first.ProductCode, second.ProductCode });
        second.Title = "Changed title"; second.Slug = "changed-slug";
        await db.SaveChangesAsync();
        Assert.Equal(101, second.ProductCode);
        db.Products.RemoveRange(first, second); await db.SaveChangesAsync();
        var third = Bag("third"); db.Add(third); await db.SaveChangesAsync();
        Assert.Equal(102, third.ProductCode);
        db.Entry(third).Property(x => x.ProductCode).CurrentValue = 300;
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    /// <summary>A rejected write rolls back the counter along with the product and permits a clean retry.</summary>
    [Fact]
    public async Task FailedInsert_DoesNotCommitItsCodeReservation()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.MigrateAsync();
        var first = Bag("same-slug"); db.Add(first); await db.SaveChangesAsync();
        var duplicate = Bag("same-slug"); db.Add(duplicate);
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        Assert.Equal(0, duplicate.ProductCode);
        duplicate.Slug = "retry-slug";
        await db.SaveChangesAsync();
        Assert.Equal(101, duplicate.ProductCode);
    }

    /// <summary>Separate concurrent contexts reserve unique ranges through the database, not a process-local lock.</summary>
    [Fact]
    public async Task ConcurrentInserts_AllocateDistinctSequentialCodes()
    {
        string path = Path.Combine(Path.GetTempPath(), $"vendora-product-codes-{Guid.NewGuid():N}.db");
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite($"Data Source={path};Pooling=False;Default Timeout=30").Options;
        try
        {
            await using (var db = new AppDbContext(options)) await db.Database.MigrateAsync();
            var codes = await Task.WhenAll(Enumerable.Range(0, 8).Select(i => Task.Run(async () =>
            {
                await using var db = new AppDbContext(options);
                var product = Bag($"concurrent-{i}"); db.Add(product);
                await db.SaveChangesAsync();
                return product.ProductCode;
            })));
            Assert.Equal(Enumerable.Range(100, 8), codes.Order());
        }
        finally
        {
            // Only this test's unique temporary SQLite files are owned by the fixture.
            foreach (string suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix);
        }
    }

    /// <summary>Codes are read-only HTTP data and exact code hits rank before text matches across sorts/pagination.</summary>
    [Fact]
    public async Task HttpContracts_ExposeCodes_AndSearchMatchesEveryDigitAlphabet()
    {
        await using var host = await Host.CreateAsync();
        using var admin = host.Client("Admin");
        var first = await Save(admin, "real-bag", "City bag");
        Assert.Equal(100, first.ProductCode);
        var second = await Save(admin, "other-bag", "100 matching title");
        Assert.Equal(101, second.ProductCode);
        var edited = await Save(admin, "renamed-bag", "Changed title", first.Id);
        Assert.Equal(100, edited.ProductCode);
        using var client = host.Client(null);
        Assert.Equal(100, (await client.GetFromJsonAsync<CatalogQueries.CatalogProductDto>($"/api/catalog/products/{first.Id}"))!.ProductCode);
        Assert.Equal(100, (await client.GetFromJsonAsync<ProductDetailDto>("/api/products/renamed-bag"))!.ProductCode);
        foreach (string query in new[] { "100", "۱۰۰", "١٠٠" })
        {
            foreach (string sort in new[] { "newest", "oldest", "priceAsc", "priceDesc" })
            {
                var result = await client.GetFromJsonAsync<CatalogSearch.PageResult>($"/api/catalog/products/search?search={Uri.EscapeDataString(query)}&sort={sort}&pageSize=1");
                Assert.Equal(first.Id, Assert.Single(result!.Products).Id);
            }
        }
        var empty = await client.GetFromJsonAsync<CatalogSearch.PageResult>("/api/catalog/products/search?search=999999999");
        Assert.Empty(empty!.Products);
        var filtered = await client.GetFromJsonAsync<CatalogSearch.PageResult>("/api/catalog/products/search?search=100&baseCategory=not-a-category");
        Assert.Empty(filtered!.Products);
        using (var scope = host.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            (await db.Products.FindAsync(first.Id))!.Status = ProductStatus.Archived;
            await db.SaveChangesAsync();
        }
        var archived = await client.GetFromJsonAsync<CatalogSearch.PageResult>("/api/catalog/products/search?search=100");
        Assert.DoesNotContain(archived!.Products, x => x.Id == first.Id);
        using var guestBody = Body("unauthorized", "Unauthorized");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync("/api/admin/products", guestBody)).StatusCode);
    }

    /// <summary>Creates minimal active products without assigning their server-owned public code.</summary>
    private static Product Bag(string slug) => new() { Title = slug, Slug = slug, Price = 250000, StockQuantity = 2, Status = ProductStatus.Active };

    /// <summary>Uses real create/edit endpoints and verifies user-supplied code fields are ignored.</summary>
    private static async Task<AdminProductDto> Save(HttpClient client, string slug, string title, Guid? id = null)
    {
        using var body = Body(slug, title);
        var response = id.HasValue ? await client.PutAsync($"/api/admin/products/{id}", body) : await client.PostAsync("/api/admin/products", body);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<AdminProductDto>())!;
    }

    /// <summary>Builds a current admin multipart form, including an untrusted code that must not be accepted.</summary>
    private static MultipartFormDataContent Body(string slug, string title)
    {
        var body = new MultipartFormDataContent();
        foreach (var (key, value) in new[] { ("title", title), ("slug", slug), ("price", "250000"), ("stockQuantity", "2"), ("status", "Active"), ("productCode", "9999") })
            body.Add(new StringContent(value), key);
        return body;
    }
}
