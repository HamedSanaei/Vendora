using System.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Persistence;

/// <summary>
/// Ensures the database is ready for the application to use.
/// </summary>
public sealed class DbInitializer
{
    private readonly IDbContextFactory<AppDbContext> _dbContextFactory;

    /// <summary>
    /// Creates a new initializer.
    /// </summary>
    /// <param name="dbContextFactory">The application database context factory.</param>
    public DbInitializer(IDbContextFactory<AppDbContext> dbContextFactory)
    {
        _dbContextFactory = dbContextFactory;
    }

    /// <summary>
    /// Applies migrations and seeds development data when needed.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token.</param>
    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        if (await TryInitializeAsync(cancellationToken))
        {
            return;
        }

        if (!IsDevelopmentEnvironment())
        {
            throw new InvalidOperationException("Database migration history is inconsistent. The Products table is missing.");
        }

        await RebuildDevelopmentDatabaseAsync(cancellationToken);
    }

    private async Task<bool> TryInitializeAsync(CancellationToken cancellationToken)
    {
        await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        await dbContext.Database.MigrateAsync(cancellationToken);

        if (!await CanQueryProductsAsync(dbContext, cancellationToken))
        {
            return false;
        }

        await SeedData.SeedAsync(dbContext, cancellationToken);
        return true;
    }

    private async Task RebuildDevelopmentDatabaseAsync(CancellationToken cancellationToken)
    {
        await using var context = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        string databasePath = GetDatabasePath(context);

        await context.Database.CloseConnectionAsync();
        await context.DisposeAsync();

        SqliteConnection.ClearAllPools();

        if (File.Exists(databasePath))
        {
            File.Delete(databasePath);
        }

        bool initialized = await TryInitializeAsync(cancellationToken);
        if (!initialized)
        {
            throw new InvalidOperationException("The development database was rebuilt, but the Products table is still missing.");
        }
    }

    private static async Task<bool> CanQueryProductsAsync(AppDbContext dbContext, CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.Products.AnyAsync(cancellationToken);
            return true;
        }
        catch (SqliteException exception) when (exception.SqliteErrorCode == 1)
        {
            return false;
        }
    }

    private static bool IsDevelopmentEnvironment()
    {
        string? environmentName = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");

        return string.Equals(environmentName, "Development", StringComparison.OrdinalIgnoreCase);
    }

    private static string GetDatabasePath(AppDbContext dbContext)
    {
        string connectionString = dbContext.Database.GetConnectionString()
            ?? throw new InvalidOperationException("The SQLite connection string is missing.");

        var builder = new SqliteConnectionStringBuilder(connectionString);
        if (string.IsNullOrWhiteSpace(builder.DataSource))
        {
            throw new InvalidOperationException("The SQLite data source is missing.");
        }

        return Path.GetFullPath(builder.DataSource, Directory.GetCurrentDirectory());
    }
}
