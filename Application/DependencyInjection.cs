using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Persistence;
using Persistence.Identity;

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
        services.AddDataProtection();
        services.AddIdentityCore<AppUser>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.SignIn.RequireConfirmedEmail = configuration.GetValue("Auth:RequireConfirmedEmail", false);
                options.Password.RequiredLength = 6;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
            })
            .AddRoles<IdentityRole<Guid>>()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddSignInManager()
            .AddDefaultTokenProviders();
        services.RemoveAll<IUserValidator<AppUser>>();
        services.AddScoped<IUserValidator<AppUser>, Sms.VerifiedPhoneUserValidator>();
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssemblyContaining<ApplicationAssemblyMarker>());
        services.AddHostedService<ApplicationDatabaseInitializerHostedService>();
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<Seo.SeoAiRateGate>();
        services.AddHostedService<Pricing.ExchangeRateRefreshService>();
        services.AddScoped<Accounting.AccountingUnitOfWork>();
        services.AddScoped<Accounting.InventoryPosting>();
        services.AddScoped<Accounting.DocumentPosting>();
        services.AddScoped<Accounting.CartQuotation>();
        services.AddScoped<Accounting.OrderReservations>();
        services.AddHostedService<Accounting.AccountingWorker>();
        services.AddScoped<Sms.SmsNotifications>();
        services.AddHostedService<Sms.SmsWorker>();

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
