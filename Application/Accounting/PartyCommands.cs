using Domain.Accounting;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

/// <summary>Explicit party identity, real money movements and partial invoice settlement.</summary>
public static class PartyCommands
{
    public sealed record Save(Guid Actor, string Key, PartyInput Input) : IRequest<Guid>;
    public sealed record ReceiveOrPay(Guid Actor, string Key, SettlementInput Input) : IRequest<Guid>;
    public sealed record Allocate(Guid Actor, string Key, Guid SettlementId, IReadOnlyList<AllocationInput> Items) : IRequest<Guid>;

    /// <summary>Creates/edits a party without merging similar names or phone numbers.</summary>
    public sealed class SaveHandler(AppDbContext db, AccountingUnitOfWork work) : IRequestHandler<Save, Guid>
    {
        public Task<Guid> Handle(Save request, CancellationToken ct) => work.ExecuteAsync(request.Actor, request.Key, "party", request,
            async token =>
            {
                var i = request.Input;
                if (string.IsNullOrWhiteSpace(i.Name) || i.Name.Length > 200 || i.Phone is null || i.Phone.Length > 50 ||
                    i.Address is null || i.Address.Length > 2000 || i.Notes is null || i.Notes.Length > 3000 ||
                    i.RegistrationNumber?.Length > 100 || !Enum.IsDefined(i.Role)) throw new AccountingException("INVALID_PARTY", 400);
                if (i.UserId.HasValue && !await db.Users.AnyAsync(x => x.Id == i.UserId, token)) throw new AccountingException("USER_NOT_FOUND", 404);
                if (i.UserId.HasValue && await db.Counterparties.AnyAsync(x => x.UserId == i.UserId && x.Id != i.Id, token))
                    throw new AccountingException("USER_ALREADY_LINKED");
                var party = i.Id.HasValue ? await db.Counterparties.SingleOrDefaultAsync(x => x.Id == i.Id, token)
                    ?? throw new AccountingException("COUNTERPARTY_NOT_FOUND", 404) : new Counterparty();
                if (i.Id.HasValue && (party.Version != i.Version || party.UserId != i.UserId)) throw new AccountingException("STALE_VERSION_OR_IDENTITY_LINK");
                party.Name = i.Name.Trim(); party.Phone = i.Phone.Trim(); party.Address = i.Address.Trim(); party.Role = i.Role;
                party.IsLegalEntity = i.IsLegalEntity; party.RegistrationNumber = i.RegistrationNumber; party.Notes = i.Notes;
                party.UserId = i.UserId; party.Version++;
                if (!i.Id.HasValue) db.Counterparties.Add(party);
                return party.Id;
            }, ct);
    }

    /// <summary>Registers real cash/bank evidence; a browser can never manufacture a verified gateway receipt.</summary>
    public sealed class ReceiveOrPayHandler(AppDbContext db, AccountingUnitOfWork work, TimeProvider time) : IRequestHandler<ReceiveOrPay, Guid>
    {
        public Task<Guid> Handle(ReceiveOrPay request, CancellationToken ct) => work.ExecuteAsync(request.Actor, request.Key, "settlement", request,
            async token =>
            {
                await work.RequireActiveAsync(token);
                var i = request.Input;
                if (!Enum.IsDefined(i.Direction) || !Enum.IsDefined(i.Method) || i.Method == SettlementMethod.VerifiedGateway ||
                    i.AmountToman <= 0 || i.AmountToman > 1_000_000_000_000_000 || i.OccurredAtUtc.Kind != DateTimeKind.Utc ||
                    i.Reference is null || i.Reference.Length > 300) throw new AccountingException("INVALID_SETTLEMENT", 400);
                if (!await db.Counterparties.AnyAsync(x => x.Id == i.CounterpartyId, token)) throw new AccountingException("COUNTERPARTY_NOT_FOUND", 404);
                var settlement = new Settlement { CounterpartyId = i.CounterpartyId, AmountToman = i.AmountToman, Direction = i.Direction,
                    Method = i.Method, Reference = i.Reference, OccurredAtUtc = i.OccurredAtUtc, PostedAtUtc = time.GetUtcNow().UtcDateTime, ActorId = request.Actor };
                db.Settlements.Add(settlement);
                db.PartyLedgerEntries.Add(new PartyLedgerEntry { CounterpartyId = i.CounterpartyId, SettlementId = settlement.Id,
                    SourceKey = $"settlement:{settlement.Id}", AmountToman = i.Direction == SettlementDirection.Receipt ? -i.AmountToman : i.AmountToman,
                    ActorId = request.Actor, PostedAtUtc = settlement.PostedAtUtc });
                return settlement.Id;
            }, ct);
    }

    /// <summary>Allocates a real receipt/payment without exceeding either the money or invoice outstanding amounts.</summary>
    public sealed class AllocateHandler(AppDbContext db, AccountingUnitOfWork work, TimeProvider time) : IRequestHandler<Allocate, Guid>
    {
        public Task<Guid> Handle(Allocate request, CancellationToken ct) => work.ExecuteAsync(request.Actor, request.Key, "allocate", request,
            async token =>
            {
                await work.RequireActiveAsync(token);
                var money = await db.Settlements.SingleOrDefaultAsync(x => x.Id == request.SettlementId, token)
                    ?? throw new AccountingException("SETTLEMENT_NOT_FOUND", 404);
                if (request.Items is null || request.Items.Count is < 1 or > 300 || request.Items.Any(x => x is null || x.AmountToman <= 0) ||
                    request.Items.Select(x => x.DocumentId).Distinct().Count() != request.Items.Count) throw new AccountingException("INVALID_ALLOCATIONS", 400);
                var existing = await db.PaymentAllocations.AsNoTracking().Where(x => x.SettlementId == money.Id).Select(x => x.AmountToman).ToListAsync(token);
                if (existing.Sum() + request.Items.Sum(x => x.AmountToman) > money.AmountToman) throw new AccountingException("ALLOCATION_EXCEEDS_SETTLEMENT");
                foreach (var item in request.Items)
                {
                    var doc = await db.FinancialDocuments.Include(x => x.Lines).SingleOrDefaultAsync(x => x.Id == item.DocumentId, token)
                        ?? throw new AccountingException("DOCUMENT_NOT_FOUND", 404);
                    var expected = money.Direction == SettlementDirection.Receipt ? DocumentKind.Sale : DocumentKind.Purchase;
                    if (doc.CounterpartyId != money.CounterpartyId || doc.Status != DocumentStatus.Posted || doc.Kind != expected)
                        throw new AccountingException("ALLOCATION_PARTY_OR_DOCUMENT_MISMATCH");
                    var assigned = await db.PaymentAllocations.AsNoTracking().Where(x => x.DocumentId == doc.Id).Select(x => x.AmountToman).ToListAsync(token);
                    var returns = await db.FinancialDocuments.AsNoTracking().Include(x => x.Lines)
                        .Where(x => x.OriginalDocumentId == doc.Id && x.Status == DocumentStatus.Posted).ToListAsync(token);
                    if (assigned.Sum() + returns.Sum(x => x.TotalToman) + item.AmountToman > doc.TotalToman) throw new AccountingException("ALLOCATION_EXCEEDS_INVOICE");
                    db.PaymentAllocations.Add(new PaymentAllocation { DocumentId = doc.Id, SettlementId = money.Id,
                        AmountToman = item.AmountToman, PostedAtUtc = time.GetUtcNow().UtcDateTime });
                }
                return money.Id;
            }, ct);
    }
}
