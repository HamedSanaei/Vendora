namespace Domain.Accounting;

/// <summary>Authoritative stock and moving-average valuation for one product.</summary>
public sealed class InventoryBalance
{
    public Guid ProductId { get; private set; }
    public int OnHand { get; private set; }
    public int Reserved { get; private set; }
    public decimal Value { get; private set; }
    public long Version { get; private set; }
    public int Available => OnHand - Reserved;
    public decimal AverageCost => OnHand == 0 ? 0 : Value / OnHand;

    private InventoryBalance() { }
    /// <summary>Starts an empty, valued stock account; legacy quantities require explicit setup.</summary>
    public InventoryBalance(Guid productId) => ProductId = productId;

    /// <summary>Receives goods at their actual landed cost and updates the moving average.</summary>
    public decimal Receive(int quantity, decimal totalCost)
    {
        if (quantity <= 0 || totalCost < 0) throw new ArgumentException("Invalid stock receipt.");
        OnHand = checked(OnHand + quantity);
        Value = checked(Value + totalCost);
        Version++;
        return totalCost;
    }

    /// <summary>Reserves free stock without changing physical quantity or valuation.</summary>
    public void Reserve(int quantity)
    {
        if (quantity <= 0 || quantity > Available) throw new InvalidOperationException("Insufficient available stock.");
        Reserved = checked(Reserved + quantity);
        Version++;
    }

    /// <summary>Releases an existing reservation; callers ensure its source is released only once.</summary>
    public void Release(int quantity)
    {
        if (quantity <= 0 || quantity > Reserved) throw new InvalidOperationException("Invalid reservation release.");
        Reserved -= quantity;
        Version++;
    }

    /// <summary>Issues goods at current average cost, optionally consuming their reservation.</summary>
    public decimal Issue(int quantity, bool fromReservation = false)
    {
        if (quantity <= 0 || quantity > (fromReservation ? Reserved : Available))
            throw new InvalidOperationException("Insufficient available stock.");
        decimal cost = quantity == OnHand ? Value : Math.Min(Value, decimal.Round(AverageCost * quantity, 8, MidpointRounding.AwayFromZero));
        OnHand -= quantity;
        if (fromReservation) Reserved -= quantity;
        Value -= cost;
        Version++;
        return cost;
    }
}

/// <summary>Append-only audit event; reservation deltas do not alter physical stock/value.</summary>
public sealed class StockMovement
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid ProductId { get; init; }
    public string SourceKey { get; init; } = "";
    public StockMovementKind Kind { get; init; }
    public int QuantityDelta { get; init; }
    public int ReservedDelta { get; init; }
    public decimal ValueDelta { get; init; }
    public Guid? ReversesMovementId { get; init; }
    public Guid ActorId { get; init; }
    public DateTime PostedAtUtc { get; init; }
    public string Reason { get; init; } = "";
}

/// <summary>Durable reservation tied to a specific order line.</summary>
public sealed class StockReservation
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid OrderId { get; init; }
    public Guid OrderItemId { get; init; }
    public Guid ProductId { get; init; }
    public int Quantity { get; init; }
    public DateTime ExpiresAtUtc { get; init; }
    public ReservationStatus Status { get; set; }
    public long Version { get; set; }
}

public enum StockMovementKind { Purchase, Sale, PurchaseReturn, SalesReturn, AdjustmentIn, AdjustmentOut, Reserve, Release, DemoOpening, DemoReset }
public enum ReservationStatus { Active, Consumed, Released, Expired }
