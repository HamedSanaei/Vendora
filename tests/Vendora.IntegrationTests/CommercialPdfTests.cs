using System.Text.Json;
using Application.Accounting;
using Application.Interfaces;
using Domain.Accounting;
using Infrastructure.Documents;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Exercises actual Community-licensed Persian rendering with isolated synthetic commercial snapshots.</summary>
public sealed class CommercialPdfTests
{
    /// <summary>Startup selects Community once without a license key, domain or network service, including Production.</summary>
    [Fact]
    public void Startup_InitializesCommunityWithoutExternalActivation()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        { ["Accounting:Pdf:License"] = "Community" }).Build();
        var environment = new TestEnvironment { EnvironmentName = "Production" };
        Assert.Null(CommercialPdfConfiguration.Initialize(configuration, environment));
        Assert.Null(CommercialPdfConfiguration.Initialize(configuration, environment));
        Assert.Equal(QuestPDF.Infrastructure.LicenseType.Community, QuestPDF.Settings.License);
        Assert.Equal("PDF_LICENSE_CONFIGURATION_CONFLICT", CommercialPdfConfiguration.Initialize(
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            { ["Accounting:Pdf:License"] = "Professional" }).Build(), environment));
        Assert.Equal(QuestPDF.Infrastructure.LicenseType.Community, QuestPDF.Settings.License);
    }

    /// <summary>A missing/invalid/evaluation-production license fails only the requested PDF.</summary>
    [Theory]
    [InlineData(null, "Development")]
    [InlineData("invalid", "Development")]
    [InlineData("Evaluation", "Production")]
    public async Task MissingLicenseFailsClearly(string? license, string environment)
    {
        var error = await Assert.ThrowsAsync<DocumentRenderUnavailableException>(() => Renderer(license, environment).RenderAsync(Snapshot(2), DocumentPaperSize.A4, default));
        Assert.Equal("PDF_LICENSE_NOT_CONFIGURED", error.Code);
    }

    /// <summary>Generates real A4/A5 multi-page fixtures with the bundled Vazirmatn family for render/extraction QA.</summary>
    [Theory]
    [InlineData(DocumentPaperSize.A4, "Proforma", 65)]
    [InlineData(DocumentPaperSize.A5, "Sale", 65)]
    [InlineData(DocumentPaperSize.A4, "Sale", 65)]
    [InlineData(DocumentPaperSize.A5, "Proforma", 65)]
    [InlineData(DocumentPaperSize.A4, "Proforma", 2)]
    [InlineData(DocumentPaperSize.A5, "Sale", 2)]
    [InlineData(DocumentPaperSize.A4, "Sale", 2)]
    [InlineData(DocumentPaperSize.A5, "Proforma", 2)]
    public async Task RendersRealPersianMultiPagePdf(DocumentPaperSize size, string kind, int count)
    {
        var bytes = await Renderer("Community", "Production").RenderAsync(Snapshot(count) with { Kind = kind }, size, default);
        Assert.True(bytes.Length > 15000);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(bytes, 0, 4));
        string? output = Environment.GetEnvironmentVariable("VENDORA_PDF_TEST_OUTPUT");
        if (!string.IsNullOrWhiteSpace(output))
        {
            Directory.CreateDirectory(output);
            await File.WriteAllBytesAsync(Path.Combine(output, $"accounting-{kind}-{size}-{count}.pdf"), bytes);
        }
    }

    /// <summary>Builds the adapter with explicit configuration independent of any actual application database.</summary>
    private static QuestCommercialDocumentRenderer Renderer(string? license, string environment) => new(
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Accounting:Pdf:License"] = license }).Build(),
        new TestEnvironment { EnvironmentName = environment }, NullLogger<QuestCommercialDocumentRenderer>.Instance);

    /// <summary>Uses only commercial snapshot fields; purchasing cost/margin cannot enter this contract.</summary>
    private static CustomerDocumentDto Snapshot(int count)
    {
        var party = JsonSerializer.Serialize(new PartySnapshot("فروشگاه وندورا", "۰۲۱۱۲۳۴۵۶۷۸", "تهران، خیابان نمونه، پلاک ۱۲"));
        return new(Guid.NewGuid(), "PRO-000100", "Proforma", "Toman", 1, DateTime.UtcNow, count * 1250000, 0, 0, count * 1250000, true,
            party, party, Enumerable.Range(1, count).Select(i => new PublicDocumentLine(Guid.NewGuid(), 100 + i,
                "کیف دوشی وندورا مدل مانلی با بند قابل تنظیم", 1, 1250000, 0, 0, 1250000)).ToList());
    }

    private sealed class TestEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "PdfTests";
        public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
