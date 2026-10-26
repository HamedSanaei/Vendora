using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Accounting;
using Application.StoreSettings;
using Domain.Entities;
using Domain.Enums;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Verifies reversible store-wide sample visibility without deleting records or changing inventory/accounting evidence.</summary>
public sealed class SeedVisibilityTests
{
    /// <summary>Hiding a seed parent preserves real child navigation while inactive real ancestors still suppress their branch.</summary>
    [Fact]
    public async Task HiddenSeedParent_PromotesRealChildForDisplayOnly()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.MigrateAsync();
        var seed = new Category { Name = "Sample parent", Slug = "sample-parent", IsActive = true };
        var inactive = new Category { Name = "Inactive real", Slug = "inactive-real", IsActive = false };
        var child = new Category { Name = "Real child", Slug = "real-child", ParentCategoryId = seed.Id, IsActive = true };
        var blocked = new Category { Name = "Blocked child", Slug = "blocked-child", ParentCategoryId = inactive.Id, IsActive = true };
        db.AddRange(seed, inactive, child, blocked);
        db.SeedRecords.Add(new SeedRecord { EntityType = nameof(Category), EntityId = seed.Id });
        await db.SaveChangesAsync();
        await new SeedDisplayUseCases.SetHandler(db).Handle(new(false), default);
        var categories = await db.DisplayCategoriesAsync(default);
        Assert.Null(categories.Single(x => x.Id == child.Id).ParentCategoryId);
        var hierarchy = new Application.Catalog.CategoryHierarchy(categories);
        Assert.True(hierarchy.IsPublic(child.Id)); Assert.False(hierarchy.IsPublic(blocked.Id));
        var tree = await new Application.Catalog.CatalogQueries.CategoriesTree.Handler(db)
            .Handle(new(), default);
        Assert.Contains(tree, x => x.Id == child.Id);
        db.ChangeTracker.Clear();
        Assert.Equal(seed.Id, (await db.Categories.SingleAsync(x => x.Id == child.Id)).ParentCategoryId);
        await new SeedDisplayUseCases.SetHandler(db).Handle(new(true), default);
        Assert.Equal(seed.Id, (await db.DisplayCategoriesAsync(default)).Single(x => x.Id == child.Id).ParentCategoryId);
    }

    /// <summary>One admin switch controls public/search/admin rows while manually created similar-looking products remain visible.</summary>
    [Fact]
    public async Task GlobalSwitch_FiltersPublicAndAdmin_AndRestoresOriginalIds()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        Guid realId, seedId;
        int originalCount;
        using (var scope = host.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await SeedData.SeedAsync(db);
            var real = new Product { Title = "محصول واقعی", Slug = "seed-manually-created-product", Price = 999, StockQuantity = 2, Status = ProductStatus.Active };
            db.Products.Add(real); await db.SaveChangesAsync(); realId = real.Id;
            seedId = await db.Products.Where(x => x.Slug == "seed-everyday-shoulder-bag").Select(x => x.Id).SingleAsync();
            originalCount = await db.Products.CountAsync();
            Assert.True(await db.SeedRecords.AnyAsync(x => x.EntityType == "Product" && x.EntityId == seedId));
            Assert.False(await db.SeedRecords.AnyAsync(x => x.EntityId == realId));
        }
        using var guest = host.Client(null); using var admin = host.Client("Admin");
        Assert.True((await guest.GetFromJsonAsync<SeedDisplayUseCases.State>("/api/store-settings/seed-visibility"))!.ShowSeedData);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync("/api/admin/store-settings/seed-visibility", new { showSeedData = false })).StatusCode);
        Assert.False((await guest.GetFromJsonAsync<StoreProfile>("/api/store-settings"))!.ShowSeedData);
        foreach (string route in new[] { "/api/catalog/products", "/api/admin/products" })
        {
            var rows = await admin.GetFromJsonAsync<JsonElement>(route);
            Assert.Single(rows.EnumerateArray());
            Assert.Equal(realId, rows[0].GetProperty("id").GetGuid());
        }
        var search = await guest.GetFromJsonAsync<JsonElement>("/api/catalog/products/search");
        Assert.Equal(1, search.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await guest.GetAsync($"/api/catalog/products/{seedId}")).StatusCode);
        var categories = await admin.GetFromJsonAsync<JsonElement>("/api/admin/categories");
        Assert.Single(categories.EnumerateArray());
        Assert.Equal("test-bags", categories[0].GetProperty("slug").GetString());
        foreach (string route in new[] { "brands", "colors", "coupons", "users", "orders" })
            Assert.Empty((await admin.GetFromJsonAsync<JsonElement>($"/api/admin/{route}")).EnumerateArray());
        var dashboard = await admin.GetFromJsonAsync<Application.Admin.Dashboard.AdminDashboardDto>("/api/admin/dashboard");
        Assert.Equal(1, dashboard!.TotalProducts); Assert.Equal(0, dashboard.TotalOrders); Assert.Equal(0, dashboard.TotalSales);
        using (var scope = host.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(originalCount, await db.Products.CountAsync());
            Assert.Equal(3, await db.Orders.CountAsync()); Assert.Equal(3, await db.PaymentTransactions.CountAsync());
            Assert.Empty(await db.StockMovements.ToListAsync()); Assert.Empty(await db.PartyLedgerEntries.ToListAsync());
        }
        await admin.PutAsJsonAsync("/api/admin/store-settings/seed-visibility", new { showSeedData = true });
        Assert.Equal(HttpStatusCode.OK, (await guest.GetAsync($"/api/catalog/products/{seedId}")).StatusCode);
        Assert.Equal(originalCount, (await admin.GetFromJsonAsync<JsonElement>("/api/admin/products")).GetArrayLength());
    }

    /// <summary>Visibility changes are admin-only and omitted target values cannot accidentally change state.</summary>
    [Fact]
    public async Task Setting_RequiresAdminAndExplicitBoolean()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var guest = host.Client(null); using var customer = host.Client("Customer"); using var admin = host.Client("Admin");
        const string route = "/api/admin/store-settings/seed-visibility";
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PutAsJsonAsync(route, new { showSeedData = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PutAsJsonAsync(route, new { showSeedData = false })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync(route, new { })).StatusCode);
        Assert.True((await guest.GetFromJsonAsync<SeedDisplayUseCases.State>("/api/store-settings/seed-visibility"))!.ShowSeedData);
    }

    /// <summary>Saving/resetting the separate branding form cannot override the administrator's seed-display policy.</summary>
    [Fact]
    public async Task BrandingSave_CannotOverrideSeedVisibility()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var admin = host.Client("Admin");
        await admin.PutAsJsonAsync("/api/admin/store-settings/seed-visibility", new { showSeedData = false });
        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(JsonSerializer.Serialize(new StoreSettingsInput(new StoreProfile { NameFa = "فروشگاه واقعی", ShowSeedData = true }),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))), "settings");
        using var saved = await admin.PutAsync("/api/admin/store-settings", form);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.False((await saved.Content.ReadFromJsonAsync<StoreProfile>())!.ShowSeedData);
        using var guest = host.Client(null);
        Assert.False((await guest.GetFromJsonAsync<SeedDisplayUseCases.State>("/api/store-settings/seed-visibility"))!.ShowSeedData);
    }

    /// <summary>Renaming seeds and re-running seed while hidden does not reveal, duplicate or reset them.</summary>
    [Fact]
    public async Task Provenance_SurvivesEditsAndRepeatedSeed_WithoutAffectingStock()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.MigrateAsync(); await SeedData.SeedCatalogAsync(db);
        var product = await db.Products.FirstAsync(); Guid id = product.Id; int stock = product.StockQuantity;
        product.Title = "عنوان ویرایش‌شده"; product.Slug = "edited-seed-product"; await db.SaveChangesAsync();
        await new SeedDisplayUseCases.SetHandler(db).Handle(new(false), default);
        Assert.Empty(await db.Products.VisibleInUi(db).ToListAsync());
        await SeedData.SeedCatalogAsync(db); int count = await db.Products.CountAsync();
        await SeedData.SeedCatalogAsync(db); Assert.Equal(count, await db.Products.CountAsync());
        Assert.Equal(stock, (await db.Products.SingleAsync(x => x.Id == id)).StockQuantity);
        Assert.Empty(await db.Products.VisibleInUi(db).ToListAsync());
        Assert.Equal(await db.Products.CountAsync(), await db.SeedRecords.CountAsync(x => x.EntityType == "Product"));
        await new SeedDisplayUseCases.SetHandler(db).Handle(new(true), default);
        Assert.Contains(await db.Products.VisibleInUi(db).ToListAsync(), x => x.Id == id && x.Slug == "edited-seed-product");
    }

    /// <summary>Old known seed slugs/history are backfilled once; an arbitrary seed-like slug is not treated as provenance.</summary>
    [Fact]
    public async Task Migration_BackfillsKnownLegacySeedsAndAliasesOnly()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.GetService<IMigrator>().MigrateAsync("20261024003215_AddOrderShippingMethodSnapshot");
        var known = new Product { Title = "Edited sample", Slug = "renamed-sample", Price = 10, Status = ProductStatus.Active };
        var real = new Product { Title = "Real", Slug = "seed-not-in-the-manifest", Price = 20, Status = ProductStatus.Active };
        // Insert the historical shape, excluding columns introduced after this migration target.
        var columns = new HashSet<string>();
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = "PRAGMA table_info('Products')";
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync()) columns.Add(reader.GetString(1));
        }
        var table = Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Table("Products", null);
        var properties = db.Model.FindEntityType(typeof(Product))!.GetProperties()
            .Where(property => property.PropertyInfo is not null && columns.Contains(property.GetColumnName(table)!)).ToList();
        foreach (var product in new[] { known, real })
        {
            var names = string.Join(",", properties.Select(property => "\"" + property.GetColumnName(table) + "\""));
            var placeholders = string.Join(",", properties.Select((_, i) => "$p" + i));
            var values = properties.Select(property => property.Name == nameof(Product.ProductCode) ? (object)(product == known ? 100 : 101) : property.PropertyInfo!.GetValue(product)).Select((value, i) => (object)new SqliteParameter("$p" + i, value is Enum e ? (object)Convert.ToInt32(e) : value ?? DBNull.Value)).ToArray();
            await using var insert = connection.CreateCommand();
            insert.CommandText = $"INSERT INTO Products ({names}) VALUES ({placeholders})";
            insert.Parameters.AddRange(values.Cast<SqliteParameter>().ToArray());
            await insert.ExecuteNonQueryAsync();
        }
        db.SlugHistories.Add(new SlugHistory { EntityId = known.Id, Kind = "product", Slug = "seed-everyday-shoulder-bag" });
        await db.SaveChangesAsync(); await db.Database.MigrateAsync();
        Assert.True(await db.SeedRecords.AnyAsync(x => x.EntityType == "Product" && x.EntityId == known.Id));
        Assert.False(await db.SeedRecords.AnyAsync(x => x.EntityId == real.Id));
        await new SeedDisplayUseCases.SetHandler(db).Handle(new(false), default);
        Assert.Equal(real.Id, (await db.Products.VisibleInUi(db).SingleAsync()).Id);
    }

    /// <summary>Current carts cannot buy hidden seeds, but existing order snapshots and raw quantities are never mutated.</summary>
    [Fact]
    public async Task HiddenSeed_CannotBeQuoted_ButUnderlyingRecordIsPreserved()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.MigrateAsync(); await SeedData.SeedCatalogAsync(db);
        var product = await db.Products.FirstAsync(x => x.StockQuantity > 0);
        int stock = product.StockQuantity;
        await new SeedDisplayUseCases.SetHandler(db).Handle(new(false), default);
        var error = await Assert.ThrowsAsync<AccountingException>(() => new CartQuotation(db, TimeProvider.System)
            .QuoteAsync([new(product.Id, 1)], "post", null, default));
        Assert.Equal("PRODUCT_NOT_FOUND", error.Code);
        Assert.Equal(stock, (await db.Products.SingleAsync(x => x.Id == product.Id)).StockQuantity);
    }
}
