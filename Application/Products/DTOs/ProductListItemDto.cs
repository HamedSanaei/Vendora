namespace Application.Products.DTOs;

/// <summary>
/// Represents the product shape used for lists and cards.
/// </summary>
public sealed record ProductListItemDto(
    Guid Id,
    string Title,
    string Slug,
    decimal Price,
    int StockQuantity,
    string? CategoryName,
    string? PrimaryImageUrl,
    int ProductCode = 0, decimal BasePrice = 0, decimal EmbeddedShippingUnitAmount = 0, long ShippingPolicyVersion = 1, bool FreeShipping = false);
