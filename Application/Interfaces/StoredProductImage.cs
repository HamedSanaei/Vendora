namespace Application.Interfaces;

/// <summary>
/// Represents a product image after it has been stored.
/// </summary>
/// <param name="Url">The public URL used by the frontend.</param>
public sealed record StoredProductImage(string Url);
