using System.Data;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Persistence.Identity;

namespace Persistence;

/// <summary>
/// Ensures the database is ready for the application to use.
/// </summary>
public sealed class DbInitializer
{
    private readonly IDbContextFactory<AppDbContext> _dbContextFactory;
    private readonly UserManager<AppUser> _userManager;
    private readonly RoleManager<IdentityRole<Guid>> _roleManager;

    /// <summary>
    /// Creates a new initializer.
    /// </summary>
    /// <param name="dbContextFactory">The application database context factory.</param>
    public DbInitializer(
        IDbContextFactory<AppDbContext> dbContextFactory,
        UserManager<AppUser> userManager,
        RoleManager<IdentityRole<Guid>> roleManager)
    {
        _dbContextFactory = dbContextFactory;
        _userManager = userManager;
        _roleManager = roleManager;
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
        await SeedIdentityAsync();
        return true;
    }

    private async Task SeedIdentityAsync()
    {
        await EnsureRoleAsync("Admin");
        await EnsureRoleAsync("Customer");
        await EnsureUserAsync("Vendora Admin", "admin@vendora.local", "09120000000", "Admin");
        var customer = await EnsureUserAsync("Test Customer", "customer@vendora.local", "09121111111", "Customer");
        await EnsureDefaultAddressAsync(customer);
    }

    private async Task EnsureRoleAsync(string role)
    {
        if (!await _roleManager.RoleExistsAsync(role))
        {
            await _roleManager.CreateAsync(new IdentityRole<Guid>(role));
        }
    }

    private async Task<AppUser> EnsureUserAsync(string fullName, string email, string phoneNumber, string role)
    {
        var user = await _userManager.FindByEmailAsync(email);
        if (user is null)
        {
            user = new AppUser
            {
                FullName = fullName,
                UserName = email,
                Email = email,
                EmailConfirmed = true,
                PhoneNumber = phoneNumber
            };
            await _userManager.CreateAsync(user, "Pass123$");
        }

        if (!await _userManager.IsInRoleAsync(user, role))
        {
            await _userManager.AddToRoleAsync(user, role);
        }

        return user;
    }

    private async Task EnsureDefaultAddressAsync(AppUser user)
    {
        await using var dbContext = await _dbContextFactory.CreateDbContextAsync();
        if (await dbContext.CustomerAddresses.AnyAsync(address => address.UserId == user.Id))
        {
            return;
        }

        await dbContext.CustomerAddresses.AddAsync(new Domain.Entities.CustomerAddress
        {
            UserId = user.Id,
            Title = "خانه",
            RecipientName = user.FullName,
            PhoneNumber = user.PhoneNumber ?? "09121111111",
            Province = "تهران",
            City = "تهران",
            StreetAddress = "خیابان ولیعصر، کوچه نمونه، پلاک ۱۲",
            Plaque = "۱۲",
            Unit = "۳",
            PostalCode = "1234567890",
            IsDefault = true
        });

        await dbContext.SaveChangesAsync();
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
