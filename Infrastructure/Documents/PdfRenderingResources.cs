using Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using QuestPDF.Drawing;

namespace Infrastructure.Documents;

/// <summary>Shared process-wide license and published Vazirmatn initialization for invoices and parcel labels.</summary>
internal static class PdfRenderingResources
{
    private static readonly object Gate = new();
    private static bool registered;

    /// <summary>Fails only the PDF request when configuration/fonts are unavailable; never loads machine fallback fonts.</summary>
    public static void EnsureReady(IConfiguration configuration, IHostEnvironment environment)
    {
        CommercialPdfConfiguration.RequireConfigured(configuration, environment);
        lock (Gate)
        {
            if (registered) return;
            string directory = Path.Combine(AppContext.BaseDirectory, "Fonts");
            string[] fonts = ["Vazirmatn-Regular.ttf", "Vazirmatn-Medium.ttf", "Vazirmatn-SemiBold.ttf", "Vazirmatn-Bold.ttf"];
            if (fonts.Any(font => !File.Exists(Path.Combine(directory, font)))) throw new DocumentRenderUnavailableException("PDF_FONT_NOT_AVAILABLE");
            foreach (string font in fonts) FontManager.RegisterFontFromFile(Path.Combine(directory, font));
            registered = true;
        }
    }
}
