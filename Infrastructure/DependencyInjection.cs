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
        services.AddHttpClient<ISmsGateway, Infrastructure.Auth.ParsGreenSmsGateway>(client => { client.Timeout = TimeSpan.FromSeconds(15); client.MaxResponseContentBufferSize = 32768; })
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        // Kavenegar authenticates in the URI path, so default HttpClient request/response URL logging must be disabled.
        services.AddHttpClient<ISmsGateway, Infrastructure.Auth.KavenegarSmsGateway>("SmsKavenegar", client => { client.Timeout = TimeSpan.FromSeconds(15); client.MaxResponseContentBufferSize = 32768; })
            .RemoveAllLoggers()
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        services.AddScoped<IPhoneCodeSender, Application.Sms.ConfiguredPhoneCodeSender>();
        services.AddSingleton<Shipping.PostexReadCache>();
        services.AddScoped<IPostexRates, Shipping.PostexRates>();
        services.AddHttpClient("PostexRates", client => { client.Timeout = TimeSpan.FromSeconds(10); client.MaxResponseContentBufferSize = 16 * 1024 * 1024; })
            .RedactLoggedHeaders(new[] { "x-api-key" })
            .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
        services.AddScoped<IProductImageStorage, LocalProductImageStorage>();
        services.AddScoped<ICommercialDocumentRenderer, Documents.QuestCommercialDocumentRenderer>();
        services.AddScoped<IShippingLabelRenderer, Documents.QuestShippingLabelRenderer>();
        services.AddScoped<IProductDescriptionService, Infrastructure.Content.ProductDescriptionService>();
        services.AddScoped<IEnamadCodeParser, Infrastructure.Content.EnamadCodeParser>();
        services.AddScoped<ISeoAiGateway, Seo.NineRouterSeoGateway>();
        services.AddHttpClient("SeoNineRouter", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(60);
            client.MaxResponseContentBufferSize = 1024 * 1024;
        }).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
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
