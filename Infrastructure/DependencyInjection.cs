using Application.Interfaces;
using Infrastructure.Storage;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure;

/// <summary>
/// Registers infrastructure adapters with the host.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds external and file-storage infrastructure services.
    /// </summary>
    /// <param name="services">The DI container.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddScoped<IProductImageStorage, LocalProductImageStorage>();
        return services;
    }
}
