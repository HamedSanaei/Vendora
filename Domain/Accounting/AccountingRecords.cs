namespace Domain.Accounting;

public enum CounterpartyRole { Customer, Supplier, Both }
public enum SettlementDirection { Receipt, Payment }
public enum SettlementMethod { Cash, BankTransfer, Card, VerifiedGateway }

/// <summary>Explicit party identity; matching names/phones never merge parties automatically.</summary>
public sealed class Counterparty
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? UserId { get; set; }
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    public string Notes { get; set; } = "";
    public bool IsLegalEntity { get; set; }
    public string? RegistrationNumber { get; set; }
    public CounterpartyRole Role { get; set; }
    public long Version { get; set; }
}

/// <summary>Append-only signed Toman party entry: positive receivable, negative payable.</summary>
public sealed class PartyLedgerEntry
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid CounterpartyId { get; init; }
    public Guid? DocumentId { get; init; }
    public Guid? SettlementId { get; init; }
    public string SourceKey { get; init; } = "";
    public decimal AmountToman { get; init; }
    public DateTime PostedAtUtc { get; init; }
    public Guid ActorId { get; init; }
}

/// <summary>A real receipt/payment; allocated and unallocated balances are derived, never overwritten.</summary>
public sealed class Settlement
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid CounterpartyId { get; init; }
    public SettlementDirection Direction { get; init; }
    public SettlementMethod Method { get; init; }
    public decimal AmountToman { get; init; }
    public string Reference { get; init; } = "";
    public DateTime OccurredAtUtc { get; init; }
    public DateTime PostedAtUtc { get; init; }
    public Guid ActorId { get; init; }
    public Guid? PaymentTransactionId { get; init; }
    public bool RequiresReview { get; init; }
}

/// <summary>Append-only assignment of existing money to an eligible posted invoice.</summary>
public sealed class PaymentAllocation
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid SettlementId { get; init; }
    public Guid DocumentId { get; init; }
    public decimal AmountToman { get; init; }
    public DateTime PostedAtUtc { get; init; }
}

/// <summary>Per-kind monotonic document numbering, updated under the accounting write gate.</summary>
public sealed class DocumentNumberSequence
{
    public DocumentKind Kind { get; set; }
    public long NextValue { get; set; } = 1;
}

/// <summary>Database-enforced, actor-scoped idempotency record persisted with all command effects.</summary>
public sealed class AccountingOperation
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid ActorId { get; init; }
    public string Key { get; init; } = "";
    public string Fingerprint { get; init; } = "";
    public string Kind { get; init; } = "";
    public Guid ResultId { get; init; }
    public DateTime PostedAtUtc { get; init; }
}

/// <summary>Explicit operational cutover flag and cross-process write gate; migration does not activate it.</summary>
public sealed class AccountingState
{
    public int Id { get; set; } = 1;
    public bool Activated { get; set; }
    public DateTime? ActivatedAtUtc { get; set; }
    public long Version { get; set; }
}
