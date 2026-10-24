using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Domain.Accounting;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

/// <summary>Serializes writes across processes; persists idempotency evidence atomically with business changes.</summary>
public sealed class AccountingUnitOfWork(AppDbContext db, TimeProvider time)
{
    /// <summary>Runs one idempotent command in a database transaction. Replayed payloads return the original result.</summary>
    public async Task<Guid> ExecuteAsync(Guid actor, string key, string kind, object payload,
        Func<CancellationToken, Task<Guid>> execute, CancellationToken ct)
    {
        if (actor == Guid.Empty || string.IsNullOrWhiteSpace(key) || key.Length > 120)
            throw new AccountingException("INVALID_OPERATION_KEY", 400);
        string fingerprint = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(kind + "\n" + JsonSerializer.Serialize(payload))));
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        try
        {
            // First SQL statement takes the write gate before any stock/sequence/idempotency reads.
            await AcquireGateAsync(ct);
            var previous = await db.AccountingOperations.AsNoTracking().SingleOrDefaultAsync(x => x.ActorId == actor && x.Key == key, ct);
            if (previous is not null)
            {
                if (previous.Fingerprint != fingerprint) throw new AccountingException("IDEMPOTENCY_KEY_REUSED");
                await tx.RollbackAsync(ct);
                return previous.ResultId;
            }
            Guid result = await execute(ct);
            db.AccountingOperations.Add(new AccountingOperation { ActorId = actor, Key = key, Kind = kind,
                Fingerprint = fingerprint, ResultId = result, PostedAtUtc = time.GetUtcNow().UtcDateTime });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return result;
        }
        catch
        {
            await tx.RollbackAsync(CancellationToken.None);
            db.ChangeTracker.Clear();
            throw;
        }
    }

    /// <summary>Acquires the common write gate inside an existing transaction, including checkout integrations.</summary>
    public async Task AcquireGateAsync(CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is null) throw new InvalidOperationException("An accounting transaction is required.");
        await db.AcquireAccountingWriteGateAsync(ct);
    }

    /// <summary>Requires the explicit audited inventory cutover before operational posting.</summary>
    public async Task RequireActiveAsync(CancellationToken ct)
    {
        if (!await db.AccountingStates.AsNoTracking().AnyAsync(x => x.Id == 1 && x.Activated, ct))
            throw new AccountingException("ACCOUNTING_SETUP_REQUIRED");
    }

    /// <summary>Allocates a permanent per-kind number while the shared database write gate is held.</summary>
    public async Task<string> NextNumberAsync(DocumentKind kind, CancellationToken ct)
    {
        var counter = await db.DocumentNumberSequences.SingleAsync(x => x.Kind == kind, ct);
        if (counter.NextValue == long.MaxValue) throw new AccountingException("DOCUMENT_SEQUENCE_EXHAUSTED");
        long value = counter.NextValue++;
        string prefix = kind switch { DocumentKind.Purchase => "PUR", DocumentKind.Sale => "SAL", DocumentKind.Proforma => "PRO",
            DocumentKind.PurchaseReturn => "PRT", DocumentKind.SalesReturn => "SRT", _ => throw new ArgumentException("Unknown document type.") };
        return $"{prefix}-{value:D6}";
    }
}
