using Application.Catalog;
using Domain.Entities;
using Domain.Enums;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Persistence;
using Xunit;

namespace Vendora.IntegrationTests;

public sealed class CatalogSeedTests
{
    private const string CatalogProductsKey = "xunit.db.disposed";

    private static async Task<AppDbContext> CreateMigratedContextAsync(string databasePath)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(new SqliteConnectionStringBuilder { DataSource = databasePath }.ToString())
            .Options;
        var context = new AppDbContext(options);
        await context.Database.EnsureCreatedAsync();
        return context;
    }

    private static async Task<AppDbContext> CreateMigrationHistoryContextAsync(string databasePath)
    {
        // Runs the actual published EF Core migrations (Database.MigrateAsync), the
        // exact path the production deploy uses, rather than EnsureCreatedAsync.
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite(new SqliteConnectionStringBuilder { DataSource = databasePath }.ToString())
            .Options;
        var context = new AppDbContext(options);
        await context.Database.MigrateAsync();
        return context;
    }

    private static string CreateTempDatabasePath()
    {
        string dir = Path.Combine(Path.GetTempPath(), "vendora-seed-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        return Path.Combine(dir, "catalog.db");
    }

    public sealed class DatabaseScope : IDisposable
    {
        public string DatabasePath { get; } = CreateTempDatabasePath();

        public void Dispose()
        {
            try
            {
                if (Directory.Exists(Path.GetDirectoryName(DatabasePath)))
                {
                    Directory.Delete(Path.GetDirectoryName(DatabasePath)!, recursive: true);
                }
            }
            catch (IOException)
            {
                // Best-effort cleanup of the temporary database directory.
            }
        }
    }

    // Note: EnsureCreatedAsync builds the schema from the model (equivalent to a
    // created migration). Unique slug indexes and relationships are applied, which
    // is what the idempotency-by-slug behavior depends on.

    [Fact]
    public async Task EmptyDatabase_SeedCatalog_PopulatesCatalog()
    {
        using var scope = new DatabaseScope();
        var context = await CreateMigratedContextAsync(scope.DatabasePath);

        await SeedData.SeedCatalogAsync(context);
        await context.SaveChangesAsync();

        Assert.NotEmpty(context.Categories);
        Assert.NotEmpty(context.Brands);
        Assert.NotEmpty(context.CatalogColors);
        Assert.NotEmpty(context.Products);
        Assert.Contains(context.Products, p => p.Slug == "leather-handbag");
        Assert.Contains(context.Products, p => p.Slug == "seed-bestseller-city-tote");
        Assert.All(context.Products, p => Assert.True(p.CategoryId.HasValue || p.Categories.Any()));
    }

    [Fact]
    public async Task RealMigrationHistory_SeedCatalogWorksAndIsIdempotent()
    {
        using var scope = new DatabaseScope();
        var context = await CreateMigrationHistoryContextAsync(scope.DatabasePath);

        await SeedData.SeedCatalogAsync(context);
        await context.SaveChangesAsync();
        int productsAfterFirst = await context.Products.CountAsync();

        Assert.True(productsAfterFirst > 0);
        Assert.Empty(context.UserAccounts);
        Assert.Empty(context.Users);

        await SeedData.SeedCatalogAsync(context);
        await context.SaveChangesAsync();

        Assert.Equal(productsAfterFirst, await context.Products.CountAsync());
    }

    [Fact]
    public async Task SecondSeedRun_DoesNotCreateDuplicates()
    {
        using var scope = new DatabaseScope();
        var context = await CreateMigratedContextAsync(scope.DatabasePath);

        await SeedData.SeedCatalogAsync(context);
        await context.SaveChangesAsync();

        int productsAfterFirst = await context.Products.CountAsync();
        int categoriesAfterFirst = await context.Categories.CountAsync();
        int brandsAfterFirst = await context.Brands.CountAsync();
        int colorsAfterFirst = await context.CatalogColors.CountAsync();

        await SeedData.SeedCatalogAsync(context);
        await context.SaveChangesAsync();

        Assert.Equal(productsAfterFirst, await context.Products.CountAsync());
        Assert.Equal(categoriesAfterFirst, await context.Categories.CountAsync());
        Assert.Equal(brandsAfterFirst, await context.Brands.CountAsync());
        Assert.Equal(colorsAfterFirst, await context.CatalogColors.CountAsync());

        // Slugs remain unique (a duplicate insert would violate the unique index).
        var productSlugs = await context.Products.Select(p => p.Slug).ToListAsync();
        Assert.Equal(productSlugs.Count, productSlugs.Distinct(StringComparer.OrdinalIgnoreCase).Count());
    }

    [Fact]
    public async Task PartialCatalog_MissingRecordsAreRestored()
    {
        using var scope = new DatabaseScope();
        var context = await CreateMigratedContextAsync(scope.DatabasePath);

        await SeedData.SeedCatalogAsync(context);
        await context.SaveChangesAsync();

        // Simulate a partially-seeded catalog by removing a curated and a showcase product.
        var leather = await context.Products.SingleAsync(p => p.Slug == "leather-handbag");
        var bestseller = await context.Products.SingleAsync(p => p.Slug == "seed-bestseller-city-tote");
        context.Products.RemoveRange(leather, bestseller);
        await context.SaveChangesAsync();

        await SeedData.SeedCatalogAsync(context);
        await context.SaveChangesAsync();

        Assert.Contains(await context.Products.Select(p => p.Slug).ToListAsync(), s => s == "leather-handbag");
        Assert.Contains(await context.Products.Select(p => p.Slug).ToListAsync(), s => s == "seed-bestseller-city-tote");
    }

    [Fact]
    public async Task ExistingProductionProduct_IsPreserved()
    {
        using var scope = new DatabaseScope();
        var context = await CreateMigratedContextAsync(scope.DatabasePath);

        await SeedData.SeedCatalogAsync(context);
        await context.SaveChangesAsync();

        // A production-created product (custom slug, not part of the seed specs).
        var custom = new Product
        {
            Title = "Custom Production Bag",
            Slug = "custom-production-bag",
            Description = "Created by an admin in production.",
            Price = 999999m,
            StockQuantity = 3,
            Status = ProductStatus.Active,
            InventoryStatus = InventoryStatus.InStock
        };
        context.Products.Add(custom);
        await context.SaveChangesAsync();

        await SeedData.SeedCatalogAsync(context);
        await context.SaveChangesAsync();

        var preserved = await context.Products.SingleOrDefaultAsync(p => p.Slug == "custom-production-bag");
        Assert.NotNull(preserved);
        Assert.Equal("Custom Production Bag", preserved!.Title);
        Assert.Equal(999999m, preserved.Price);
    }

    [Fact]
    public async Task ProductionSeed_DoesNotCreateDevUsersOrIdentityData()
    {
        using var scope = new DatabaseScope();
        var context = await CreateMigratedContextAsync(scope.DatabasePath);

        await SeedData.SeedCatalogAsync(context);
        await context.SaveChangesAsync();

        Assert.Empty(context.UserAccounts);
        Assert.Empty(context.Carts);
        Assert.Empty(context.CustomerAddresses);
        Assert.Empty(context.Orders);
        Assert.Empty(context.Users);
    }

    [Fact]
    public async Task ActiveSeededProducts_AreReturnedByCatalogQuery()
    {
        using var scope = new DatabaseScope();
        var context = await CreateMigratedContextAsync(scope.DatabasePath);

        await SeedData.SeedCatalogAsync(context);
        await context.SaveChangesAsync();

        var handler = new CatalogQueries.Products.Handler(context);
        var result = await handler.Handle(new CatalogQueries.Products.Query(), CancellationToken.None);

        Assert.NotEmpty(result);
        Assert.Contains(result, p => p.Slug == "leather-handbag");

        int activeInDb = await context.Products.CountAsync(p => p.Status == ProductStatus.Active);
        Assert.Equal(activeInDb, result.Count);
    }
}