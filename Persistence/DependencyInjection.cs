using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Persistence.Carts;
using Persistence.Common;
using Persistence.Orders;
using Persistence.Products;

namespace Persistence;

/// <summary>
/// Registers persistence services with the host.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds the Vendora database context and initializer.
    /// </summary>
    /// <param name="services">The DI container.</param>
    /// <param name="configuration">The application configuration.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddPersistence(this IServiceCollection services, IConfiguration configuration)
    {
        string connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Data Source=vendora.db";

        services.AddDbContext<AppDbContext>(
            options => options.UseSqlite(connectionString),
            contextLifetime: ServiceLifetime.Scoped,
            optionsLifetime: ServiceLifetime.Singleton);
        services.AddDbContextFactory<AppDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<IUnitOfWork>(sp => sp.GetRequiredService<AppDbContext>());
        services.AddScoped<ICartRepository, CartRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IProductReadRepository, ProductReadRepository>();
        services.AddScoped<DbInitializer>();

        return services;
    }
}
