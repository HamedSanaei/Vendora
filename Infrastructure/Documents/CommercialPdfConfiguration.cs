using Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using QuestPDF.Infrastructure;

namespace Infrastructure.Documents;

/// <summary>Initializes the process-wide PDF license at startup; no keys, registration or network activation are used.</summary>
public static class CommercialPdfConfiguration
{
    private static readonly object Gate = new();
    private static LicenseType? configuredLicense;

    /// <summary>Applies the explicitly configured license once, or returns a safe PDF-only configuration error.</summary>
    public static string? Initialize(IConfiguration configuration, IHostEnvironment environment)
    {
        string? value = configuration["Accounting:Pdf:License"];
        if (string.IsNullOrWhiteSpace(value) || !Enum.TryParse<LicenseType>(value, true, out var license)
            || !Enum.IsDefined(license) || (license == LicenseType.Evaluation && environment.IsProduction()))
            return "PDF_LICENSE_NOT_CONFIGURED";

        lock (Gate)
        {
            if (configuredLicense.HasValue && configuredLicense != license)
                return "PDF_LICENSE_CONFIGURATION_CONFLICT";
            if (!configuredLicense.HasValue)
            {
                // The business owner confirmed Community eligibility; do not infer it from the repository being public.
                if (license == LicenseType.Community)
                    QuestPDF.Settings.License = LicenseType.Community;
                else
                    QuestPDF.Settings.License = license;
                configuredLicense = license;
            }
            return null;
        }
    }

    /// <summary>Protects direct renderer consumers as well as the web host without disabling unrelated accounting operations.</summary>
    public static void RequireConfigured(IConfiguration configuration, IHostEnvironment environment)
    {
        string? error = Initialize(configuration, environment);
        if (error is not null) throw new DocumentRenderUnavailableException(error);
    }
}
