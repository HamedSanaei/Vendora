using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Attributes;
using Application.Catalog;
using Application.Products.DTOs;
using Domain.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence;
using Xunit;
using Host = Vendora.IntegrationTests.ProductArticleTests.ArticleHost;

namespace Vendora.IntegrationTests;

/// <summary>Exercises actual HTTP endpoints and SQLite persistence for global and product-local specifications.</summary>
public sealed class ProductAttributeTests
{
    /// <summary>Global names and ordered terms round-trip; hidden rows stay private, while list payloads remain small.</summary>
    [Fact]
    public async Task GlobalAndLocalAttributes_RoundTripAndRespectVisibility()
    {
        await using var host = await Host.CreateAsync();
        using var client = host.Client("Admin");
        var (global, term) = await Registry(client);
        var rows = new[] { Global(global.Id, term.Id), Local("ابعاد", "۳۰ × ۴۰", "۲۰ × ۱۰"), Local("Internal note", "Secret") with { IsVisible = false } };
        var product = await SaveProduct(client, host.CategoryId, rows);
        Assert.Equal(3, product.Attributes!.Count);
        var loaded = await client.GetFromJsonAsync<AdminProductDto>($"/api/admin/products/{product.Id}");
        Assert.Equal(["جنس", "ابعاد", "Internal note"], loaded!.Attributes!.Select(x => x.Name));
        Assert.Equal(["۳۰ × ۴۰", "۲۰ × ۱۰"], loaded.Attributes![1].Values);
        var detail = await client.GetFromJsonAsync<CatalogQueries.CatalogProductDto>($"/api/catalog/products/{product.Id}");
        Assert.Equal(2, detail!.Attributes!.Count);
        Assert.DoesNotContain("Secret", JsonSerializer.Serialize(detail));
        Assert.Equal(["برزنت"], detail.Attributes[0].Values);
        var list = await client.GetFromJsonAsync<CatalogQueries.CatalogProductDto[]>("/api/catalog/products");
        Assert.Null(Assert.Single(list!).Attributes);

        // Array order, visibility and multiple terms are replacement semantics, not append-only.
        var edited = await SaveProduct(client, host.CategoryId, [rows[1], rows[0] with { IsVisible = false }], product.Id);
        Assert.Equal(["ابعاد", "جنس"], edited.Attributes!.Select(x => x.Name));
        detail = await client.GetFromJsonAsync<CatalogQueries.CatalogProductDto>($"/api/catalog/products/{product.Id}");
        Assert.Equal("ابعاد", Assert.Single(detail!.Attributes!).Name);
    }

    /// <summary>Old clients cannot accidentally wipe attributes; an explicit empty array intentionally clears them and their values.</summary>
    [Fact]
    public async Task OmittedAttributes_Preserve_AndEmptyAttributes_Clear()
    {
        await using var host = await Host.CreateAsync();
        using var client = host.Client("Admin");
        var product = await SaveProduct(client, host.CategoryId, [Local("وزن", "۲۰۰ گرم")]);
        var legacy = await SaveProduct(client, host.CategoryId, null, product.Id);
        Assert.Single(legacy.Attributes!);
        var cleared = await SaveProduct(client, host.CategoryId, [], product.Id);
        Assert.Empty(cleared.Attributes!);
    }

    /// <summary>Product-specific specifications do not require a global category or attribute definition.</summary>
    [Fact]
    public async Task CustomAttributes_DoNotRequireCategory()
    {
        await using var host = await Host.CreateAsync();
        using var client = host.Client("Admin");
        var product = await SaveProduct(client, Guid.Empty, [Local("کاربرد", "سفر")]);
        Assert.Null(product.CategoryId);
        var edited = await SaveProduct(client, Guid.Empty, [Local("کاربرد", "روزمره")], product.Id);
        Assert.Null(edited.CategoryId);
        Assert.Equal("روزمره", Assert.Single(edited.Attributes!).Values[0]);
    }

    /// <summary>Registry renames affect assigned products; archived definitions/terms remain on old products but cannot be newly assigned.</summary>
    [Fact]
    public async Task RegistryRenameAndArchive_PreserveExistingReferences()
    {
        await using var host = await Host.CreateAsync();
        using var client = host.Client("Admin");
        var (global, term) = await Registry(client);
        var product = await SaveProduct(client, host.CategoryId, [Global(global.Id, term.Id)]);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/admin/attributes/{global.Id}/terms/{term.Id}", new { name = "چرم", isActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/admin/attributes/{global.Id}", new { name = "جنس بدنه", isActive = false })).StatusCode);
        var loaded = await client.GetFromJsonAsync<AdminProductDto>($"/api/admin/products/{product.Id}");
        Assert.Equal("جنس بدنه", loaded!.Attributes![0].Name);
        Assert.Equal("چرم", loaded.Attributes[0].Values[0]);
        Assert.Single((await SaveProduct(client, host.CategoryId, [Global(global.Id, term.Id)], product.Id)).Attributes!);
        using var body = Body(host.CategoryId, JsonSerializer.Serialize(new[] { Global(global.Id, term.Id) }), "another-product");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/admin/products", body)).StatusCode);
    }

    /// <summary>A term cannot be assigned under another definition; failed edits preserve the original row and product data.</summary>
    [Fact]
    public async Task CrossAttributeTerm_IsRejectedAtomically()
    {
        await using var host = await Host.CreateAsync();
        using var client = host.Client("Admin");
        var (global, term) = await Registry(client);
        var second = (await (await client.PostAsJsonAsync("/api/admin/attributes", new { name = "اندازه" })).Content.ReadFromJsonAsync<AttributeCatalog.DefinitionDto>())!;
        var product = await SaveProduct(client, host.CategoryId, [Local("وزن", "۵۰۰ گرم")]);
        using var body = Body(host.CategoryId, JsonSerializer.Serialize(new[] { Global(second.Id, term.Id) }));
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsync($"/api/admin/products/{product.Id}", body)).StatusCode);
        var loaded = await client.GetFromJsonAsync<AdminProductDto>($"/api/admin/products/{product.Id}");
        Assert.Equal("وزن", Assert.Single(loaded!.Attributes!).Name);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync($"/api/admin/attributes/{second.Id}/terms/{term.Id}", new { name = "invalid" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/admin/attributes/{global.Id}/terms", new { name = "برزنت" })).StatusCode);
    }

    /// <summary>Bad JSON, duplicate names/values, empty values, unknown IDs and input limits are rejected at the boundary.</summary>
    [Theory]
    [InlineData("not json")]
    [InlineData("null")]
    [InlineData("[null]")]
    [InlineData("[{\"name\":\"\",\"values\":[\"x\"]}]")]
    [InlineData("[{\"name\":\"A\",\"values\":[]}]")]
    [InlineData("[{\"name\":\"A\",\"values\":[null]}]")]
    [InlineData("[{\"name\":\"A\",\"values\":[\"x\",\" X \"]}]")]
    [InlineData("[{\"name\":\"A\",\"values\":[\"x\"]},{\"name\":\" a \",\"values\":[\"y\"]}]")]
    [InlineData("[{\"catalogAttributeId\":\"00000000-0000-0000-0000-000000000001\",\"termIds\":[\"00000000-0000-0000-0000-000000000002\"]}]")]
    public async Task InvalidInput_IsRejected(string json)
    {
        await using var host = await Host.CreateAsync();
        using var client = host.Client("Admin");
        using var body = Body(host.CategoryId, json);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/admin/products", body)).StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<AdminProductDto[]>("/api/admin/products"))!);
    }

    /// <summary>Server-side limits are enforced even if the editor's length limits are bypassed.</summary>
    [Fact]
    public async Task OversizedAttributes_AreRejected()
    {
        await using var host = await Host.CreateAsync();
        using var client = host.Client("Admin");
        foreach (var rows in new[] { Enumerable.Range(0, 31).Select(i => Local($"attr{i}", "x")).ToArray(),
            new[] { Local(new string('a', 101), "x") }, new[] { Local("a", new string('x', 501)) },
            new[] { Local("a", Enumerable.Range(0, 31).Select(x => x.ToString()).ToArray()) } })
        {
            using var body = Body(host.CategoryId, JsonSerializer.Serialize(rows));
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/admin/products", body)).StatusCode);
        }
    }

    /// <summary>Registry access requires admin authorization, including write requests.</summary>
    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("Customer", HttpStatusCode.Forbidden)]
    public async Task Registry_RequiresAdmin(string? role, HttpStatusCode expected)
    {
        await using var host = await Host.CreateAsync();
        using var client = host.Client(role);
        Assert.Equal(expected, (await client.GetAsync("/api/admin/attributes")).StatusCode);
        Assert.Equal(expected, (await client.PostAsJsonAsync("/api/admin/attributes", new { name = "test" })).StatusCode);
    }

    /// <summary>Additive migration upgrades a pre-feature database without changing existing product fields.</summary>
    [Fact]
    public async Task Migration_PreservesExistingProducts()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.GetService<IMigrator>().MigrateAsync("20261020120034_ExpandProductDescriptionForRichText");
        var product = new Product { Title = "Existing bag", Slug = "existing-bag", Price = 150000, Description = "<p>Existing article</p>" };
        // Insert through the legacy schema, not the current model which now requires a public code.
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Products" ("Id", "Title", "Slug", "Price", "Description", "StockQuantity", "Status", "InventoryStatus", "CreatedAtUtc")
            VALUES ({product.Id}, {product.Title}, {product.Slug}, {product.Price}, {product.Description}, {0}, {0}, {0}, {DateTime.UtcNow})
            """);
        await db.Database.MigrateAsync();
        var loaded = await db.Products.Include(x => x.Attributes).SingleAsync();
        Assert.Equal(product.Description, loaded.Description); Assert.Equal(product.Price, loaded.Price); Assert.Empty(loaded.Attributes);
    }

    /// <summary>Creates one reusable definition and owned term in the isolated test host.</summary>
    private static async Task<(AttributeCatalog.DefinitionDto, AttributeCatalog.TermDto)> Registry(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/admin/attributes", new { name = "جنس" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var definition = (await response.Content.ReadFromJsonAsync<AttributeCatalog.DefinitionDto>())!;
        response = await client.PostAsJsonAsync($"/api/admin/attributes/{definition.Id}/terms", new { name = "برزنت" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (definition, (await response.Content.ReadFromJsonAsync<AttributeCatalog.TermDto>())!);
    }

    /// <summary>Constructs a valid local specification with explicit visibility.</summary>
    private static ProductAttributeInput Local(string name, params string[] values) => new(null, name, [], values);
    /// <summary>Constructs a global specification without trusting copied names from the client.</summary>
    private static ProductAttributeInput Global(Guid id, Guid term) => new(id, null, [term], []);

    /// <summary>Saves through the same multipart endpoints used by the admin, asserting actual persistence success.</summary>
    private static async Task<AdminProductDto> SaveProduct(HttpClient client, Guid category, ProductAttributeInput[]? rows, Guid? id = null)
    {
        using var body = Body(category, rows is null ? null : JsonSerializer.Serialize(rows));
        var response = id.HasValue ? await client.PutAsync($"/api/admin/products/{id}", body) : await client.PostAsync("/api/admin/products", body);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        return (await response.Content.ReadFromJsonAsync<AdminProductDto>())!;
    }

    /// <summary>Builds a bounded multipart request, optionally omitting the new field for legacy clients.</summary>
    private static MultipartFormDataContent Body(Guid category, string? attributes, string slug = "attribute-test")
    {
        var body = new MultipartFormDataContent();
        foreach (var (key, value) in new[] { ("title", "Attribute test"), ("slug", slug), ("price", "250000"), ("stockQuantity", "4"), ("status", "Active") })
            body.Add(new StringContent(value), key);
        if (category != Guid.Empty) body.Add(new StringContent(category.ToString()), "categoryId");
        if (attributes is not null) body.Add(new StringContent(attributes), "attributesJson");
        return body;
    }
}
