using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Persistence;

/// <summary>
/// Creates the DbContext for EF Core design-time tooling when the API startup assembly is unavailable.
/// </summary>
public sealed class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    /// <summary>
    /// Creates an AppDbContext configured for local SQLite migrations.
    /// </summary>
    public AppDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
        optionsBuilder.UseSqlite("Data Source=../API/vendora-dev.db");
        return new AppDbContext(optionsBuilder.Options);
    }
}
