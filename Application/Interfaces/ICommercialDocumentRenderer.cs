using Application.Accounting;

namespace Application.Interfaces;

public enum DocumentPaperSize { A4, A5 }

/// <summary>Renders only the isolated customer-safe snapshot, never the internal accounting model.</summary>
public interface ICommercialDocumentRenderer
{
    /// <summary>Creates a Persian printable PDF with the requested real paper size or fails with a safe availability code.</summary>
    Task<byte[]> RenderAsync(CustomerDocumentDto document, DocumentPaperSize size, CancellationToken cancellationToken);
}

/// <summary>A PDF-only configuration/rendering failure; other accounting functionality remains available.</summary>
public sealed class DocumentRenderUnavailableException(string code) : Exception(code)
{
    public string Code { get; } = code;
}
