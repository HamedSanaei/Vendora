namespace Domain.Accounting;

public enum DocumentKind { Purchase, Sale, Proforma, PurchaseReturn, SalesReturn }
public enum DocumentStatus { Draft, Posted, Voided }
public enum DocumentCurrency { Toman, Usd }

/// <summary>Immutable party details captured when a document is finalized.</summary>
public sealed record PartySnapshot(string Name, string Phone, string Address, string? RegistrationNumber = null, string? ShippingTerms = null, long? ShippingPolicyVersion = null, decimal? EmbeddedShippingUnitAmount = null);

/// <summary>A commercial document; posted monetary/party/line snapshots cannot be edited.</summary>
public sealed class FinancialDocument
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public string Number { get; private set; } = "";
    public DocumentKind Kind { get; private set; }
    public DocumentStatus Status { get; private set; }
    public DocumentCurrency Currency { get; private set; }
    public decimal ExchangeRate { get; private set; }
    public Guid CounterpartyId { get; private set; }
    public Guid? CustomerUserId { get; private set; }
    public Guid? OrderId { get; private set; }
    public Guid? OriginalDocumentId { get; private set; }
    public DateTime IssuedAtUtc { get; private set; }
    public DateTime? PostedAtUtc { get; private set; }
    public Guid CreatedBy { get; private set; }
    public long Version { get; private set; }
    public decimal Freight { get; private set; }
    public bool PurchaseTaxRecoverable { get; private set; }
    public bool ShippingUndetermined { get; private set; }
    public string Notes { get; private set; } = "";
    public string SellerSnapshotJson { get; private set; } = "{}";
    public string BuyerSnapshotJson { get; private set; } = "{}";
    public ICollection<FinancialDocumentLine> Lines { get; private set; } = new List<FinancialDocumentLine>();
    public decimal Net => Lines.Sum(x => x.Net);
    public decimal Tax => Lines.Sum(x => x.Tax);
    public decimal Total => Net + Tax + Freight;
    public decimal TotalToman => decimal.Round(Total * ExchangeRate, 0, MidpointRounding.AwayFromZero);

    private FinancialDocument() { }
    /// <summary>Creates a draft with a permanently reserved document number and confirmed currency rate.</summary>
    public FinancialDocument(string number, DocumentKind kind, DocumentCurrency currency, decimal exchangeRate,
        Guid counterpartyId, Guid actor, DateTime issuedAtUtc, Guid? originalDocumentId = null,
        Guid? customerUserId = null, Guid? orderId = null)
    {
        if (!Enum.IsDefined(kind) || !Enum.IsDefined(currency) || exchangeRate <= 0 || (currency == DocumentCurrency.Toman && exchangeRate != 1))
            throw new ArgumentException("Invalid currency or exchange rate.");
        if (counterpartyId == Guid.Empty || actor == Guid.Empty || issuedAtUtc.Kind != DateTimeKind.Utc)
            throw new ArgumentException("A counterparty, actor and UTC issue date are required.");
        if ((kind is DocumentKind.PurchaseReturn or DocumentKind.SalesReturn) != originalDocumentId.HasValue)
            throw new ArgumentException("Returns require an original document.");
        Number = number; Kind = kind; Currency = currency; ExchangeRate = exchangeRate;
        CounterpartyId = counterpartyId; CreatedBy = actor; IssuedAtUtc = issuedAtUtc;
        OriginalDocumentId = originalDocumentId; CustomerUserId = customerUserId; OrderId = orderId;
    }

    /// <summary>Replaces draft content only; never mutates a posted document.</summary>
    public void SetDraftContent(IEnumerable<FinancialDocumentLine> lines, decimal freight, bool taxRecoverable,
        string notes, string sellerSnapshotJson, string buyerSnapshotJson, bool shippingUndetermined = false)
    {
        RequireDraft();
        var items = lines.ToList();
        if (items.Count is < 1 or > 300 || freight < 0 || notes.Length > 3000 || items.Any(x => x.DocumentId != Id))
            throw new ArgumentException("Invalid document contents.");
        Lines = items; Freight = freight; PurchaseTaxRecoverable = taxRecoverable; Notes = notes;
        SellerSnapshotJson = sellerSnapshotJson; BuyerSnapshotJson = buyerSnapshotJson;
        ShippingUndetermined = shippingUndetermined; Version++;
    }

    /// <summary>Edits a draft's party/date/currency before posting; changing its numbered document kind requires a new document.</summary>
    public void SetDraftHeader(DocumentCurrency currency, decimal exchangeRate, Guid counterpartyId,
        DateTime issuedAtUtc, Guid? originalDocumentId, Guid? customerUserId)
    {
        RequireDraft();
        if (!Enum.IsDefined(currency) || exchangeRate <= 0 || (currency == DocumentCurrency.Toman && exchangeRate != 1)
            || counterpartyId == Guid.Empty || issuedAtUtc.Kind != DateTimeKind.Utc ||
            ((Kind is DocumentKind.PurchaseReturn or DocumentKind.SalesReturn) != originalDocumentId.HasValue))
            throw new ArgumentException("Invalid draft header.");
        Currency = currency; ExchangeRate = exchangeRate; CounterpartyId = counterpartyId; IssuedAtUtc = issuedAtUtc;
        OriginalDocumentId = originalDocumentId; CustomerUserId = customerUserId; Version++;
    }

    /// <summary>Freezes the document after its inventory and party entries have been prepared in the transaction.</summary>
    public void Post(DateTime utcNow)
    {
        RequireDraft();
        if (Lines.Count == 0) throw new InvalidOperationException("A document must have lines.");
        Status = DocumentStatus.Posted; PostedAtUtc = utcNow; Version++;
    }

    /// <summary>Voids an unposted draft; posted documents require an explicit return instead.</summary>
    public void VoidDraft() { RequireDraft(); Status = DocumentStatus.Voided; Version++; }

    /// <summary>Enforces immutable finalized/voided documents.</summary>
    private void RequireDraft()
    {
        if (Status != DocumentStatus.Draft) throw new InvalidOperationException("Only draft documents may be changed.");
    }
}

/// <summary>Captured commercial line, including internal cost that is never part of customer DTOs.</summary>
public sealed class FinancialDocumentLine
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid DocumentId { get; private set; }
    public Guid ProductId { get; private set; }
    public int ProductCode { get; private set; }
    public string Title { get; private set; } = "";
    public int Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal? BaseUnitPrice { get; private set; }
    public decimal EmbeddedShippingUnitAmount { get; private set; }
    public decimal Discount { get; private set; }
    public decimal Tax { get; private set; }
    public Guid? OriginalLineId { get; private set; }
    public decimal? CostToman { get; private set; }
    public decimal? ValuationDifferenceToman { get; private set; }
    public decimal Net => Quantity * UnitPrice - Discount;
    private FinancialDocumentLine() { }

    /// <summary>Snapshots a validated line. Discount/tax are line totals, not percentages.</summary>
    public FinancialDocumentLine(Guid documentId, Guid productId, int productCode, string title,
        int quantity, decimal unitPrice, decimal discount, decimal tax, Guid? originalLineId = null, decimal? baseUnitPrice = null, decimal embeddedShippingUnitAmount = 0)
    {
        if (quantity <= 0 || productId == Guid.Empty || title.Length is < 1 or > 500 || unitPrice < 0 || discount < 0 || discount > quantity * unitPrice || tax < 0)
            throw new ArgumentException("Invalid invoice line.");
        if (embeddedShippingUnitAmount < 0 || (baseUnitPrice.HasValue && (baseUnitPrice < 0 || unitPrice != baseUnitPrice + embeddedShippingUnitAmount || discount > baseUnitPrice * quantity)))
            throw new ArgumentException("Invalid embedded shipping snapshot.");
        BaseUnitPrice = baseUnitPrice; EmbeddedShippingUnitAmount = embeddedShippingUnitAmount;
        DocumentId = documentId; ProductId = productId; ProductCode = productCode; Title = title;
        Quantity = quantity; UnitPrice = unitPrice; Discount = discount; Tax = tax; OriginalLineId = originalLineId;
    }

    /// <summary>Captures the posting-time cost once; historical unknown cost is left null.</summary>
    public void RecordCost(decimal cost, decimal? difference = null)
    {
        if (CostToman.HasValue || cost < 0) throw new InvalidOperationException("Cost is already captured or invalid.");
        CostToman = cost; ValuationDifferenceToman = difference;
    }
}
