using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using MediatR;
using Persistence;

namespace Application;

/// <summary>
/// Registers application services and composes persistence behind the application boundary.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds application use cases and underlying persistence services.
    /// </summary>
    /// <param name="services">The service collection.</param>
    /// <param name="configuration">The host configuration.</param>
    /// <returns>The same service collection.</returns>
    public static IServiceCollection AddApplication(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddPersistence(configuration);
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssemblyContaining<ApplicationAssemblyMarker>());
        services.AddHostedService<ApplicationDatabaseInitializerHostedService>();

        return services;
    }
}

internal sealed class ApplicationAssemblyMarker;

internal sealed class ApplicationDatabaseInitializerHostedService : IHostedService
{
    private readonly IServiceProvider _serviceProvider;

    public ApplicationDatabaseInitializerHostedService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var initializer = scope.ServiceProvider.GetRequiredService<DbInitializer>();
        await initializer.InitializeAsync(cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
