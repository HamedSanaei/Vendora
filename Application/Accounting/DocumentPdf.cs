using Application.Interfaces;
using Domain.Accounting;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

/// <summary>Uses identical safe snapshots for authorized print/download; administrators cannot request supplier/cost PDFs.</summary>
public static class DocumentPdf
{
    public sealed record Query(Guid Id, Guid UserId, bool IsAdmin, DocumentPaperSize Size) : IRequest<Result?>;
    public sealed record Result(byte[] Bytes, string FileName);

    /// <summary>Checks ownership/type/state before rendering; never passes internal EF entities to the renderer.</summary>
    public sealed class Handler(AppDbContext db, ICommercialDocumentRenderer renderer) : IRequestHandler<Query, Result?>
    {
        public async Task<Result?> Handle(Query request, CancellationToken ct)
        {
            if (!Enum.IsDefined(request.Size)) throw new AccountingException("INVALID_PAPER_SIZE", 400);
            var query = db.FinancialDocuments.AsNoTracking().Where(x => x.Id == request.Id && x.Status == DocumentStatus.Posted
                && (x.Kind == DocumentKind.Sale || x.Kind == DocumentKind.Proforma));
            if (!request.IsAdmin) query = query.Where(x => x.CustomerUserId == request.UserId);
            var doc = await query.Include(x => x.Lines).SingleOrDefaultAsync(ct);
            if (doc is null) return null;
            var bytes = await renderer.RenderAsync(AccountingMappings.Customer(doc), request.Size, ct);
            return new(bytes, $"{doc.Number}-{request.Size}.pdf");
        }
    }
}
