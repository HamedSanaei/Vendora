using System.Globalization;
using System.Text.Json;
using Application.Accounting;
using Application.Interfaces;
using Domain.Accounting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using QuestPDF.Drawing;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Infrastructure.Documents;

/// <summary>Renders the Penpot A4/A5 commercial templates using only public, immutable document snapshots.</summary>
public sealed class QuestCommercialDocumentRenderer(IConfiguration configuration, IHostEnvironment environment,
    ILogger<QuestCommercialDocumentRenderer> logger) : ICommercialDocumentRenderer
{
    private static readonly object FontGate = new();
    private static bool fontsRegistered;
    private const string Ink = "#171B1F", Soft = "#F7F5F0", Line = "#DDD8CE", Brass = "#B89555";
    private static readonly CultureInfo Persian = CultureInfo.GetCultureInfo("fa-IR");

    /// <summary>Checks explicit licensing and actual font files at PDF request time, without disabling the accounting host.</summary>
    public Task<byte[]> RenderAsync(CustomerDocumentDto document, DocumentPaperSize size, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (!Enum.IsDefined(size) || document.Kind is not ("Sale" or "Proforma"))
            throw new DocumentRenderUnavailableException("PDF_DOCUMENT_NOT_SUPPORTED");
        try
        {
            ConfigureRenderer();
            bool compact = size == DocumentPaperSize.A5, quote = document.Kind == "Proforma";
            var seller = ReadParty(document.SellerSnapshotJson);
            var buyer = ReadParty(document.BuyerSnapshotJson);
            var pdf = Document.Create(root => root.Page(page =>
            {
                page.Size(compact ? PageSizes.A5 : PageSizes.A4);
                page.Margin(compact ? 22 : 32);
                page.ContentFromRightToLeft();
                page.DefaultTextStyle(x => x.FontFamily("Vazirmatn").FontSize(compact ? 9 : 10).FontColor(Ink));
                page.Header().Column(header =>
                {
                    header.Item().Height(5).Background(Brass);
                    header.Item().PaddingTop(compact ? 8 : 16).Text("VENDORA · " + seller.Name).FontSize(compact ? 15 : 20).Bold();
                    header.Item().PaddingTop(compact ? 5 : 10).Text(quote ? "پیش‌فاکتور" : "فاکتور فروش").FontSize(compact ? 17 : 23).Bold();
                    header.Item().PaddingVertical(compact ? 5 : 10).Text($"شماره: {document.Number}     تاریخ صدور: {Digits(document.IssuedAtUtc.ToString("yyyy/MM/dd", Persian))}").FontSize(compact ? 8 : 9).FontColor("#74797C");
                    header.Item().PaddingBottom(compact ? 8 : 16).LineHorizontal(0.7f).LineColor(Line);
                });
                page.Content().Column(content =>
                {
                    content.Spacing(compact ? 8 : 22);
                    content.Item().Row(row =>
                    {
                        row.Spacing(16);
                        row.RelativeItem().Element(x => PartyBox(x, "خریدار", buyer, compact));
                        row.RelativeItem().Element(x => PartyBox(x, "فروشنده", seller, compact));
                    });
                    content.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(3);
                            if (!compact) columns.RelativeColumn();
                            columns.RelativeColumn(); columns.RelativeColumn(2); columns.RelativeColumn(2);
                        });
                        table.Header(h =>
                        {
                            foreach (string label in compact ? new[] { "کالا / کد", "تعداد", "قیمت واحد", "مبلغ" }
                                : new[] { "شرح کالا", "کد", "تعداد", "قیمت واحد", "مبلغ" })
                                h.Cell().Background(Soft).Padding(compact ? 5 : 8).Text(label).SemiBold();
                        });
                        foreach (var item in document.Lines)
                        {
                            table.Cell().Element(x => Cell(x, compact)).Text(compact ? $"{item.Title}\nکد {N(item.ProductCode)}" : item.Title);
                            if (!compact) table.Cell().Element(x => Cell(x, compact)).Text(N(item.ProductCode));
                            table.Cell().Element(x => Cell(x, compact)).Text(N(item.Quantity));
                            table.Cell().Element(x => Cell(x, compact)).Text(N(item.UnitPrice));
                            table.Cell().Element(x => Cell(x, compact)).Text(N(item.Total));
                        }
                    });
                    // Keep the monetary summary and its terms together; never create a trailing terms-only page.
                    content.Item().ShowEntire().Column(summary =>
                    {
                    summary.Spacing(compact ? 8 : 22);
                    summary.Item().Background(Soft).Padding(compact ? 8 : 14).Column(totals =>
                    {
                        string unit = document.Currency == "Usd" ? "دلار" : "تومان";
                        totals.Spacing(compact ? 3 : 8);
                        totals.Item().Text($"جمع پس از تخفیف: {N(document.Net)} {unit}");
                        totals.Item().Text($"مالیات: {N(document.Tax)} {unit}");
                        totals.Item().Text(document.ShippingUndetermined ? "کرایه: در مرحلهٔ ارسال تعیین می‌شود"
                            : $"کرایه منظورشده در سند: {N(document.Freight)} {unit}");
                        if (!string.IsNullOrWhiteSpace(buyer.ShippingTerms)) totals.Item().Text(buyer.ShippingTerms);
                        if (document.Currency == "Usd") totals.Item().Text($"نرخ ثبت‌شده: {N(document.ExchangeRate)} تومان");
                        totals.Item().PaddingTop(4).Text($"مبلغ نهایی: {N(document.TotalToman)} تومان").FontSize(compact ? 12 : 15).Bold();
                    });
                    summary.Item().Background("#F6EBD9").Padding(compact ? 8 : 14).Text(quote
                        ? "قیمت‌ها مربوط به زمان صدور است. این سند رسید پرداخت، تضمین قیمت یا رزرو موجودی نیست. قیمت و موجودی هنگام ثبت سفارش دوباره بررسی می‌شوند."
                        : "این فاکتور براساس ثبت قطعی صادر شده است. سوابق تسویه فقط براساس دریافت‌های ثبت‌شده محاسبه می‌شوند. اصلاح از مسیر سند برگشتی انجام می‌شود.").FontSize(compact ? 8 : 9).FontColor("#8D6B36");
                    });
                });
                page.Footer().PaddingTop(12).BorderTop(0.7f).BorderColor(Line).PaddingTop(8).AlignCenter().Text(text =>
                {
                    text.DefaultTextStyle(x => x.FontSize(8).FontColor("#74797C"));
                    text.Span(document.Number + "  ·  صفحه "); text.CurrentPageNumber().Format(value => Digits(value?.ToString() ?? "000")); text.Span(" از "); text.TotalPages().Format(value => Digits(value?.ToString() ?? "000"));
                });
            })).GeneratePdf();
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(pdf);
        }
        catch (OperationCanceledException) { throw; }
        catch (DocumentRenderUnavailableException) { throw; }
        catch (Exception exception)
        {
            // Layout exceptions may embed customer text. Log only the safe identifier and failure type.
            logger.LogError("Commercial PDF rendering failed for document {DocumentId}: {FailureType}", document.Id, exception.GetType().Name);
            throw new DocumentRenderUnavailableException("PDF_RENDER_FAILED");
        }
    }

    /// <summary>Checks startup licensing and loads the published font files once, including in offline Linux containers.</summary>
    private void ConfigureRenderer()
    {
        CommercialPdfConfiguration.RequireConfigured(configuration, environment);
        lock (FontGate)
        {
            string fontDirectory = Path.Combine(AppContext.BaseDirectory, "Fonts");
            string[] fonts = ["Vazirmatn-Regular.ttf", "Vazirmatn-Medium.ttf", "Vazirmatn-SemiBold.ttf", "Vazirmatn-Bold.ttf"];
            if (!fontsRegistered)
            {
                if (fonts.Any(font => !File.Exists(Path.Combine(fontDirectory, font))))
                    throw new DocumentRenderUnavailableException("PDF_FONT_NOT_AVAILABLE");
                foreach (string font in fonts) FontManager.RegisterFontFromFile(Path.Combine(fontDirectory, font));
                fontsRegistered = true;
            }
        }
    }

    /// <summary>Formats invariant decimal monetary values for Persian display, preserving USD fractional units.</summary>
    private static string N(decimal value) => Digits(value.ToString("#,0.########", Persian));

    /// <summary>Persian culture formatting alone does not substitute native numeral glyphs in .NET.</summary>
    private static string Digits(string value) => string.Concat(value.Select(c => c is >= '0' and <= '9' ? "۰۱۲۳۴۵۶۷۸۹"[c - '0'] : c));

    /// <summary>Draws the recurring Penpot neutral party card with persisted identity fields only.</summary>
    private static void PartyBox(IContainer container, string title, PartySnapshot party, bool compact) => container.Background(Soft).Padding(compact ? 8 : 12).Column(column =>
    {
        column.Spacing(compact ? 2 : 5); column.Item().Text(title).Bold(); column.Item().Text(party.Name);
        if (!string.IsNullOrWhiteSpace(party.Phone)) column.Item().Text("تماس: " + party.Phone);
        if (!string.IsNullOrWhiteSpace(party.Address)) column.Item().Text(party.Address);
        if (!string.IsNullOrWhiteSpace(party.RegistrationNumber)) column.Item().Text("شناسه: " + party.RegistrationNumber);
    });

    /// <summary>Applies a splitting-safe line style so long invoices paginate naturally with repeating table headers.</summary>
    private static IContainer Cell(IContainer container, bool compact) => container.ShowEntire().BorderBottom(0.5f).BorderColor(Line).PaddingVertical(compact ? 6 : 12).PaddingHorizontal(compact ? 4 : 6);

    /// <summary>Parses the stored public snapshot without falling back to mutable live party information.</summary>
    private static PartySnapshot ReadParty(string json) => JsonSerializer.Deserialize<PartySnapshot>(json)
        ?? throw new DocumentRenderUnavailableException("PDF_INVALID_SNAPSHOT");
}
