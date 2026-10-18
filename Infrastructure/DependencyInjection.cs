using Application.Interfaces;
using Infrastructure.Maps;
using Infrastructure.Storage;
using Microsoft.Extensions.DependencyInjection;
using Infrastructure.Pricing;

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
        services.AddHttpClient("UsdtPublicRates", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(8);
            client.MaxResponseContentBufferSize = 2 * 1024 * 1024;
            client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        foreach (string source in new[] { "Nobitex", "Wallex", "AbanTether" })
        {
            services.AddScoped<IUsdtRateSource>(provider => new PublicUsdtRateSource(source,
                provider.GetRequiredService<IHttpClientFactory>()));
        }
        services.AddHttpClient<IAddressGeocoder, NeshanAddressGeocoder>(client =>
        {
            client.BaseAddress = new Uri("https://api.neshan.org/");
            client.Timeout = TimeSpan.FromSeconds(8);
        })
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        return services;
    }
}
