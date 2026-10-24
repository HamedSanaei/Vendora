using Domain.Accounting;

namespace Application.Accounting;

/// <summary>Safe application failure, mapped by the accounting HTTP adapter without database details.</summary>
public sealed class AccountingException(string code, int status = 409) : Exception(code)
{
    public string Code { get; } = code;
    public int Status { get; } = status;
}

public sealed record DocumentLineInput(Guid ProductId, int Quantity, decimal UnitPrice, decimal Discount = 0, decimal Tax = 0, Guid? OriginalLineId = null);
public sealed record DraftInput(Guid? Id, long Version, DocumentKind Kind, Guid CounterpartyId, DocumentCurrency Currency,
    decimal ExchangeRate, DateTime IssuedAtUtc, IReadOnlyList<DocumentLineInput> Lines,
    decimal Freight = 0, bool PurchaseTaxRecoverable = false, string Notes = "", Guid? OriginalDocumentId = null);
public sealed record PartyInput(Guid? Id, long Version, string Name, string Phone, string Address, CounterpartyRole Role,
    bool IsLegalEntity = false, string? RegistrationNumber = null, string Notes = "", Guid? UserId = null);
public sealed record SettlementInput(Guid CounterpartyId, SettlementDirection Direction, SettlementMethod Method,
    decimal AmountToman, DateTime OccurredAtUtc, string Reference);
public sealed record AllocationInput(Guid DocumentId, decimal AmountToman);

/// <summary>Customer-safe line: deliberately excludes cost and margin.</summary>
public sealed record PublicDocumentLine(Guid Id, int ProductCode, string Title, int Quantity, decimal UnitPrice, decimal Discount, decimal Tax, decimal Total);
/// <summary>Ownership-checked customer document; no counterparty/supplier identifiers or internal cost fields.</summary>
public sealed record CustomerDocumentDto(Guid Id, string Number, string Kind, string Currency, decimal ExchangeRate,
    DateTime IssuedAtUtc, decimal Net, decimal Tax, decimal Freight, decimal TotalToman, bool ShippingUndetermined,
    string SellerSnapshotJson, string BuyerSnapshotJson, IReadOnlyList<PublicDocumentLine> Lines);
public sealed record AdminDocumentLineDto(Guid Id, Guid ProductId, int ProductCode, string Title, int Quantity,
    decimal UnitPrice, decimal Discount, decimal Tax, Guid? OriginalLineId, decimal? CostToman, decimal? ValuationDifferenceToman);
public sealed record AdminDocumentDto(Guid Id, string Number, DocumentKind Kind, DocumentStatus Status, Guid CounterpartyId,
    DocumentCurrency Currency, decimal ExchangeRate, DateTime IssuedAtUtc, DateTime? PostedAtUtc, long Version,
    decimal Freight, decimal TotalToman, string Notes, Guid? OriginalDocumentId, Guid? OrderId, IReadOnlyList<AdminDocumentLineDto> Lines,
    bool PurchaseTaxRecoverable, string SellerSnapshotJson, string BuyerSnapshotJson);
public sealed record PageResult<T>(IReadOnlyList<T> Items, int Page, int PageSize, int Total);

/// <summary>Uses the repository's existing explicit mapping pattern; AutoMapper is not installed.</summary>
public static class AccountingMappings
{
    /// <summary>Maps an internal invoice for authorized administrators only.</summary>
    public static AdminDocumentDto Admin(FinancialDocument d) => new(d.Id, d.Number, d.Kind, d.Status, d.CounterpartyId,
        d.Currency, d.ExchangeRate, d.IssuedAtUtc, d.PostedAtUtc, d.Version, d.Freight, d.TotalToman, d.Notes,
        d.OriginalDocumentId, d.OrderId, d.Lines.Select(l => new AdminDocumentLineDto(l.Id, l.ProductId, l.ProductCode,
            l.Title, l.Quantity, l.UnitPrice, l.Discount, l.Tax, l.OriginalLineId, l.CostToman, l.ValuationDifferenceToman)).ToList(),
        d.PurchaseTaxRecoverable, d.SellerSnapshotJson, d.BuyerSnapshotJson);

    /// <summary>Projects only approved commercial snapshots into the customer's download/read model.</summary>
    public static CustomerDocumentDto Customer(FinancialDocument d) => new(d.Id, d.Number, d.Kind.ToString(), d.Currency.ToString(),
        d.ExchangeRate, d.IssuedAtUtc, d.Net, d.Tax, d.Freight, d.TotalToman, d.ShippingUndetermined, d.SellerSnapshotJson,
        d.BuyerSnapshotJson, d.Lines.Select(l => new PublicDocumentLine(l.Id, l.ProductCode, l.Title, l.Quantity,
            l.UnitPrice, l.Discount, l.Tax, l.Net + l.Tax)).ToList());
}
