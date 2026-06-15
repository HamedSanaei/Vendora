namespace Domain.Enums;

/// <summary>
/// Represents the inventory availability state of a product or stock record.
/// </summary>
public enum InventoryStatus
{
    Unknown = 0,
    InStock = 1,
    LowStock = 2,
    OutOfStock = 3,
    Discontinued = 4
}
