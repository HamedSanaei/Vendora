using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.Accounting;
using Application.Interfaces;
using Domain.Accounting;
using Infrastructure.Documents;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using QuestPDF.Infrastructure;

// This isolated diagnostic uses synthetic snapshots only: it never constructs a DbContext or starts the API.
string outputDirectory = args.Length == 1 ? Path.GetFullPath(args[0]) : "/out";
Directory.CreateDirectory(outputDirectory);
// Read the default license from the actual published production configuration, never from machine/production secrets.
var configuration = new ConfigurationBuilder().SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false).Build();
var environment = new PdfSmokeEnvironment();
string? error = CommercialPdfConfiguration.Initialize(configuration, environment);
if (error is not null || QuestPDF.Settings.License != LicenseType.Community)
    throw new InvalidOperationException(error ?? "Community license was not selected at startup.");

var renderer = new QuestCommercialDocumentRenderer(configuration, environment, NullLogger<QuestCommercialDocumentRenderer>.Instance);
foreach (string kind in new[] { "Sale", "Proforma" })
foreach (DocumentPaperSize size in Enum.GetValues<DocumentPaperSize>())
foreach (int count in new[] { 2, 65 })
{
    var snapshot = Snapshot(kind, count);
    byte[] bytes = await renderer.RenderAsync(snapshot, size, default);
    if (bytes.Length < 15000 || Encoding.ASCII.GetString(bytes, 0, 4) != "%PDF")
        throw new InvalidOperationException("PDF output is missing or invalid.");
    string name = $"community-linux-{kind}-{size}-{count}.pdf";
    await File.WriteAllBytesAsync(Path.Combine(outputDirectory, name), bytes);
    Console.WriteLine($"{name}: {bytes.Length} bytes SHA256={Convert.ToHexString(SHA256.HashData(bytes))}");
}
var labelRenderer = new QuestShippingLabelRenderer(configuration, environment, NullLogger<QuestShippingLabelRenderer>.Instance);
string labelOutput = Path.Combine(outputDirectory, "shipping-labels"); Directory.CreateDirectory(labelOutput);
foreach (string variant in new[] { "single", "multiple", "long" })
{
    var labels = Enumerable.Range(0, variant == "multiple" ? 3 : 1).Select(Label).ToArray();
    if (variant == "long") labels[0] = labels[0] with { StreetAddress = string.Join("، ", Enumerable.Repeat("خیابان نمونه، کوچه آزمایشی، مجتمع وندورا", 5)) };
    byte[] bytes = await labelRenderer.RenderAsync(labels, default);
    await File.WriteAllBytesAsync(Path.Combine(labelOutput, $"shipping-label-{variant}-A5.pdf"), bytes);
    Console.WriteLine($"Shipping label {variant}: {bytes.Length} bytes");
}
try
{
    await labelRenderer.RenderAsync([Label(0) with { StreetAddress = string.Join(" ", Enumerable.Repeat("نشانی غیرقابل‌جاگیری", 2000)) }], default);
    throw new InvalidOperationException("Oversized label was not rejected.");
}
catch (Application.Orders.ShippingLabels.LabelException exception) when (exception.Code == "LABEL_CONTENT_TOO_LONG") { }
Console.WriteLine($"PASS: Community / {System.Runtime.InteropServices.RuntimeInformation.OSDescription} / {Environment.UserName}; invoices and A5 labels; no DB or network required.");

/// <summary>Supplies an isolated logistics-only snapshot for the production Linux renderer.</summary>
static ShippingLabelData Label(int index) => new(Guid.NewGuid(), $"VD-{100 + index}", "گیرنده آزمایشی فارسی", "09121234567", "تهران", "تهران", "خیابان نمونه، کوچه آزمایشی", "۱۲", "۳", "1234567890", "فروشگاه وندورا", "تهران، خیابان فرستنده، پلاک ۴۵", "02112345678", index == 1 ? "تیپاکس" : "پست پیشتاز", index == 1 ? "پرداخت هنگام تحویل" : "رایگان");

/// <summary>Creates a fixed, synthetic Persian snapshot with long titles and real decimal totals for offline render validation.</summary>
static CustomerDocumentDto Snapshot(string kind, int count)
{
    string seller = JsonSerializer.Serialize(new PartySnapshot("فروشگاه وندورا ـ دادهٔ آزمون", "۰۲۱۱۲۳۴۵۶۷۸", "تهران، خیابان نمونه، پلاک ۱۲"));
    string buyer = JsonSerializer.Serialize(new PartySnapshot("خریدار آزمایشی فارسی", "۰۹۱۲۱۲۳۴۵۶۷", "نشانی آزمایشی با متن بلند برای بررسی چیدمان راست به چپ", ShippingTerms: "پست پیشتاز ـ پیش‌پرداخت کرایه"));
    var lines = Enumerable.Range(1, count).Select(i => new PublicDocumentLine(Guid.NewGuid(), 100 + i,
        $"کیف دوشی وندورا مدل مانلی با بند قابل تنظیم و محفظه داخلی ـ ردیف {i}", 1, 1250000, 10000, 2000, 1242000)).ToList();
    return new(Guid.NewGuid(), kind == "Sale" ? "SAL-000100" : "PRO-000100", kind, "Toman", 1,
        new DateTime(2026, 10, 24, 12, 0, 0, DateTimeKind.Utc), count * 1240000m, count * 2000m, 60000,
        count * 1242000m + 60000, false, seller, buyer, lines);
}

/// <summary>Uses production rendering rules without creating the web host or loading private application configuration.</summary>
sealed class PdfSmokeEnvironment : IHostEnvironment
{
    public string EnvironmentName { get; set; } = Environments.Production;
    public string ApplicationName { get; set; } = "Vendora.PdfSmoke";
    public string ContentRootPath { get; set; } = AppContext.BaseDirectory;
    public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
}
