using Application.Interfaces;
using Application.Orders;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Infrastructure.Documents;

/// <summary>Black-and-white parcel labels with one complete, untruncated RTL A5 page per order.</summary>
public sealed class QuestShippingLabelRenderer(IConfiguration configuration, IHostEnvironment environment,
    ILogger<QuestShippingLabelRenderer> logger) : IShippingLabelRenderer
{
    /// <inheritdoc />
    public Task<byte[]> RenderAsync(IReadOnlyList<ShippingLabelData> labels, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested(); PdfRenderingResources.EnsureReady(configuration, environment);
        if (labels.Count is < 1 or > 100) throw new ShippingLabels.LabelException("LABEL_INVALID_SELECTION", 400);
        try
        {
            // Retry the complete document at a consistent readable size; ShowEntire forbids split labels or clipped addresses.
            foreach (int size in new[] { 12, 11, 10 })
            {
                ct.ThrowIfCancellationRequested();
                try { return Task.FromResult(Render(labels, size, ct)); }
                catch (QuestPDF.Drawing.Exceptions.DocumentLayoutException) when (size > 10) { }
                catch (QuestPDF.Drawing.Exceptions.DocumentLayoutException)
                {
                    foreach (var label in labels)
                    {
                        try { Render([label], 10, ct); }
                        catch (QuestPDF.Drawing.Exceptions.DocumentLayoutException) { throw new ShippingLabels.LabelException("LABEL_CONTENT_TOO_LONG", 422, label.OrderNumber); }
                    }
                    throw;
                }
            }
            throw new DocumentRenderUnavailableException("PDF_RENDER_FAILED");
        }
        catch (OperationCanceledException) { throw; }
        catch (ShippingLabels.LabelException) { throw; }
        catch (DocumentRenderUnavailableException) { throw; }
        catch (Exception exception)
        {
            // Layout/debug messages may contain private addresses. Never log exception text or the document payload.
            logger.LogError("Shipping label PDF failed: {FailureType}", exception.GetType().Name);
            throw new DocumentRenderUnavailableException("PDF_RENDER_FAILED");
        }
    }

    /// <summary>Creates independent A5 pages with a single non-splitting content block; no filesystem or carrier access.</summary>
    private static byte[] Render(IReadOnlyList<ShippingLabelData> labels, int size, CancellationToken ct) => Document.Create(document =>
    {
        foreach (var label in labels)
        {
            ct.ThrowIfCancellationRequested();
            document.Page(page =>
            {
                page.Size(PageSizes.A5); page.Margin(8, Unit.Millimetre); page.ContentFromRightToLeft();
                page.DefaultTextStyle(style => style.FontFamily("Vazirmatn").FontSize(size).FontColor(Colors.Black));
                page.Content().ShowEntire().Border(1).Padding(12).Column(column =>
                {
                    column.Spacing(10);
                    column.Item().AlignCenter().Text("برچسب ارسال").FontSize(13).Bold();
                    column.Item().AlignCenter().Text("شماره سفارش").FontSize(10);
                    column.Item().ContentFromLeftToRight().AlignCenter().Text(label.OrderNumber).FontSize(20).Bold();
                    column.Item().LineHorizontal(1);
                    column.Item().Text("گیرنده").Bold();
                    column.Item().Text(label.RecipientName).FontSize(16).Bold();
                    column.Item().Text($"{label.Province}، {label.City}، {label.StreetAddress}");
                    if (!string.IsNullOrWhiteSpace(label.Plaque) || !string.IsNullOrWhiteSpace(label.Unit))
                        column.Item().Text(string.Join("   ", new[] { string.IsNullOrWhiteSpace(label.Plaque) ? null : "پلاک: " + label.Plaque, string.IsNullOrWhiteSpace(label.Unit) ? null : "واحد: " + label.Unit }.Where(x => x is not null)));
                    column.Item().Element(x => Number(x, "کد پستی", label.PostalCode));
                    column.Item().Element(x => Number(x, "تلفن گیرنده", label.RecipientPhone));
                    column.Item().LineHorizontal(1);
                    column.Item().Text("فرستنده: " + label.SenderName).Bold();
                    column.Item().Text(label.SenderAddress);
                    column.Item().Element(x => Number(x, "تلفن پشتیبانی", label.SupportPhone));
                    column.Item().LineHorizontal(1);
                    column.Item().Text("روش ارسال: " + label.ShippingMethod);
                    column.Item().Text("کرایه: " + label.ShippingTerms).Bold();
                });
            });
        }
    }).GeneratePdf();

    /// <summary>Keeps phone/postal-code digit runs LTR while the field label remains correctly ordered in RTL.</summary>
    private static void Number(IContainer container, string caption, string value) => container.Row(row =>
    {
        row.AutoItem().PaddingLeft(8).Text(caption + ":");
        row.RelativeItem().ContentFromLeftToRight().AlignRight().Text(value);
    });
}
