using System.Text.Json;
using Application.StoreSettings;
using Domain.Accounting;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

/// <summary>Focused document write use cases; controllers cannot write accounting entities directly.</summary>
public static class DocumentCommands
{
    public sealed record SaveDraft(Guid Actor, string Key, DraftInput Input) : IRequest<Guid>;
    public sealed record Post(Guid Actor, string Key, Guid Id, long Version) : IRequest<Guid>;
    public sealed record VoidDraft(Guid Actor, string Key, Guid Id, long Version) : IRequest<Guid>;

    /// <summary>Validates references and updates drafts without generating stock/party entries.</summary>
    public sealed class SaveDraftHandler(AppDbContext db, AccountingUnitOfWork work) : IRequestHandler<SaveDraft, Guid>
    {
        public Task<Guid> Handle(SaveDraft request, CancellationToken ct) => work.ExecuteAsync(request.Actor, request.Key, "draft", request,
            async token =>
            {
                var input = request.Input;
                if (input.Lines is null || input.Lines.Count is < 1 or > 300 || input.Notes is null || input.Notes.Length > 3000 ||
                    input.IssuedAtUtc.Kind != DateTimeKind.Utc || input.Freight < 0 || input.ExchangeRate > 1_000_000_000 ||
                    input.Lines.Any(x => x is null || x.Quantity is < 1 or > 1_000_000 || x.UnitPrice < 0 || x.UnitPrice > 1_000_000_000_000 || x.Tax < 0 || x.Tax > 1_000_000_000_000))
                    throw new AccountingException("INVALID_DOCUMENT", 400);
                var party = await db.Counterparties.SingleOrDefaultAsync(x => x.Id == input.CounterpartyId, token)
                    ?? throw new AccountingException("COUNTERPARTY_NOT_FOUND", 404);
                var doc = input.Id.HasValue ? await db.FinancialDocuments.Include(x => x.Lines).SingleOrDefaultAsync(x => x.Id == input.Id, token)
                    ?? throw new AccountingException("DOCUMENT_NOT_FOUND", 404)
                    : new FinancialDocument(await work.NextNumberAsync(input.Kind, token), input.Kind, input.Currency,
                        input.ExchangeRate, party.Id, request.Actor, input.IssuedAtUtc, input.OriginalDocumentId,
                        input.Kind is DocumentKind.Sale or DocumentKind.Proforma ? party.UserId : null);
                if (input.Id.HasValue && (doc.Version != input.Version || doc.Kind != input.Kind))
                    throw new AccountingException("STALE_VERSION_OR_DOCUMENT_KIND");
                if (doc.Status != DocumentStatus.Draft) throw new AccountingException("DOCUMENT_NOT_DRAFT");
                if (input.Id.HasValue) doc.SetDraftHeader(input.Currency, input.ExchangeRate, party.Id, input.IssuedAtUtc,
                    input.OriginalDocumentId, input.Kind is DocumentKind.Sale or DocumentKind.Proforma ? party.UserId : null);
                var ids = input.Lines.Select(x => x.ProductId).Distinct().ToList();
                var returnIds = input.Lines.Where(x => x.OriginalLineId.HasValue).Select(x => x.OriginalLineId).ToList();
                if (returnIds.Distinct().Count() != returnIds.Count) throw new AccountingException("DUPLICATE_RETURN_LINE", 400);
                var products = await db.Products.AsNoTracking().Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, token);
                if (products.Count != ids.Count) throw new AccountingException("PRODUCT_NOT_FOUND", 404);
                var lines = new List<FinancialDocumentLine>();
                var original = input.OriginalDocumentId.HasValue
                    ? await db.FinancialDocuments.AsNoTracking().Include(x => x.Lines).SingleOrDefaultAsync(x => x.Id == input.OriginalDocumentId, token)
                    : null;
                foreach (var line in input.Lines)
                {
                    var product = products[line.ProductId];
                    if (input.OriginalDocumentId.HasValue && !line.OriginalLineId.HasValue) throw new AccountingException("RETURN_LINE_REQUIRED", 400);
                    if (!input.OriginalDocumentId.HasValue && line.OriginalLineId.HasValue) throw new AccountingException("UNEXPECTED_RETURN_LINE", 400);
                    var sourceLine = line.OriginalLineId.HasValue ? original?.Lines.SingleOrDefault(x => x.Id == line.OriginalLineId && x.ProductId == line.ProductId) : null;
                    if (line.OriginalLineId.HasValue && sourceLine is null) throw new AccountingException("INVALID_RETURN_SOURCE", 400);
                    // Return money is derived in decimal on the server; browser floating-point ratios are never authoritative.
                    lines.Add(new FinancialDocumentLine(doc.Id, product.Id, sourceLine?.ProductCode ?? product.ProductCode,
                        sourceLine?.Title ?? product.Title, line.Quantity, sourceLine?.UnitPrice ?? line.UnitPrice,
                        sourceLine is null ? line.Discount : sourceLine.Discount * line.Quantity / sourceLine.Quantity,
                        sourceLine is null ? line.Tax : sourceLine.Tax * line.Quantity / sourceLine.Quantity, line.OriginalLineId));
                }
                if (input.Id.HasValue) db.FinancialDocumentLines.RemoveRange(doc.Lines);
                string seller = await SellerSnapshotAsync(db, token);
                string buyer = JsonSerializer.Serialize(new PartySnapshot(party.Name, party.Phone, party.Address, party.RegistrationNumber));
                doc.SetDraftContent(lines, input.Freight, input.PurchaseTaxRecoverable, input.Notes, seller, buyer);
                if (input.Id.HasValue) db.FinancialDocumentLines.AddRange(lines);
                if (!input.Id.HasValue) db.FinancialDocuments.Add(doc);
                return doc.Id;
            }, ct);
    }

    /// <summary>Posts exactly once; all cost, stock and financial evidence share the transaction.</summary>
    public sealed class PostHandler(AppDbContext db, AccountingUnitOfWork work, DocumentPosting posting) : IRequestHandler<Post, Guid>
    {
        public Task<Guid> Handle(Post request, CancellationToken ct) => work.ExecuteAsync(request.Actor, request.Key, "post", request,
            async token =>
            {
                var doc = await db.FinancialDocuments.Include(x => x.Lines).SingleOrDefaultAsync(x => x.Id == request.Id, token)
                    ?? throw new AccountingException("DOCUMENT_NOT_FOUND", 404);
                if (doc.Kind != DocumentKind.Proforma) await work.RequireActiveAsync(token);
                if (doc.Version != request.Version) throw new AccountingException("STALE_VERSION");
                await posting.PostAsync(doc, request.Actor, token); return doc.Id;
            }, ct);
    }

    /// <summary>Voids an unposted draft only; finalized documents require linked return documents.</summary>
    public sealed class VoidDraftHandler(AppDbContext db, AccountingUnitOfWork work) : IRequestHandler<VoidDraft, Guid>
    {
        public Task<Guid> Handle(VoidDraft request, CancellationToken ct) => work.ExecuteAsync(request.Actor, request.Key, "void-draft", request,
            async token =>
            {
                var doc = await db.FinancialDocuments.SingleOrDefaultAsync(x => x.Id == request.Id, token)
                    ?? throw new AccountingException("DOCUMENT_NOT_FOUND", 404);
                if (doc.Version != request.Version) throw new AccountingException("STALE_VERSION");
                doc.VoidDraft(); return doc.Id;
            }, ct);
    }

    /// <summary>Reads current seller details; documents retain this serialized snapshot permanently on posting.</summary>
    internal static async Task<string> SellerSnapshotAsync(AppDbContext db, CancellationToken ct)
    {
        var settings = await db.SeoSettings.AsNoTracking().SingleOrDefaultAsync(ct) ?? new SeoSettings();
        var profile = StoreSettingsUseCases.Read(settings);
        return JsonSerializer.Serialize(new PartySnapshot(profile.NameFa ?? settings.SiteName, profile.Phone ?? "", profile.AddressFa ?? ""));
    }
}
