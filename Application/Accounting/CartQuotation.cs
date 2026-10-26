using Application.Shipping;
using Application.Catalog;
using Domain.Entities;
using Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Accounting;

public sealed record CartQuoteItem(Guid ProductId, int Quantity, decimal? ExpectedUnitPrice = null);
public sealed record QuotedLine(Product Product, int Quantity, decimal Discount, decimal UnitPrice, decimal EmbeddedShippingUnitAmount);
public sealed record CartQuote(IReadOnlyList<QuotedLine> Lines, decimal Freight, bool ShippingUndetermined, ShippingPolicy Policy)
{
    public decimal Net => Lines.Sum(x => x.UnitPrice * x.Quantity - x.Discount);
    public decimal Discount => Lines.Sum(x => x.Discount);
}

/// <summary>Authoritative shared order/proforma pricing; never reads browser money as a total or calls exchanges.</summary>
public sealed class CartQuotation(AppDbContext db, TimeProvider time)
{
    /// <summary>Resolves products, valid coupon/category scope and configured shipping into one server quote.</summary>
    public async Task<CartQuote> QuoteAsync(IReadOnlyList<CartQuoteItem> items, string? shippingMethod, string? couponCode, CancellationToken ct, Guid? shippingQuoteId = null, Guid? userId = null, Guid? addressId = null, bool requireShipping = false)
    {
        if (items is null || items.Count is < 1 or > 300 || items.Any(x => x is null || x.ProductId == Guid.Empty || x.Quantity is < 1 or > 100000))
            throw new AccountingException("INVALID_CART", 400);
        var grouped = items.GroupBy(x => x.ProductId).Select(g => new CartQuoteItem(g.Key, checked(g.Sum(x => x.Quantity)),
            g.Select(x => x.ExpectedUnitPrice).Distinct().Count() == 1 ? g.First().ExpectedUnitPrice : null)).OrderBy(x => x.ProductId).ToList();
        if (requireShipping && string.IsNullOrWhiteSpace(shippingMethod)) throw new AccountingException("SHIPPING_METHOD_REQUIRED", 400);
        var policy = await ShippingPricing.ReadAsync(db, ct);
        ShippingPricing.ValidateMethod(shippingMethod, grouped.Sum(x => x.Quantity));
        var ids = grouped.Select(x => x.ProductId).ToList();
        var products = await db.Products.VisibleInUi(db).Include(x => x.Categories).Where(x => ids.Contains(x.Id) && x.Status == ProductStatus.Active).ToDictionaryAsync(x => x.Id, ct);
        if (products.Count != ids.Count) throw new AccountingException("PRODUCT_NOT_FOUND", 404);
        foreach (var item in grouped)
        {
            var p = products[item.ProductId];
            if (p.StockQuantity < item.Quantity) throw new AccountingException("INSUFFICIENT_STOCK");
            if ((item.ExpectedUnitPrice.HasValue || p.UsdPrice.HasValue || policy.IncludedInPrice) && item.ExpectedUnitPrice != policy.SellingPrice(p.Price))
                throw new Pricing.PriceChangedException(p.Id, policy.SellingPrice(p.Price));
        }
        decimal discount = 0;
        var eligible = grouped;
        if (!string.IsNullOrWhiteSpace(couponCode))
        {
            string code = couponCode.Trim().ToUpperInvariant();
            if (code.Length > 100) throw new AccountingException("INVALID_COUPON", 400);
            var coupon = await db.Coupons.VisibleInUi(db).AsNoTracking().Include(x => x.Categories).SingleOrDefaultAsync(x => x.Code.ToUpper() == code, ct);
            if (coupon is null || !coupon.IsActive || coupon.ExpiresAtUtc <= time.GetUtcNow().UtcDateTime ||
                coupon.DiscountPercent is <= 0 or > 100) throw new AccountingException("INVALID_COUPON", 400);
            if (!coupon.AppliesToAllCategories)
            {
                var tree = new CategoryHierarchy(await db.Categories.AsNoTracking().ToListAsync(ct));
                var scope = tree.Descendants(coupon.Categories.Select(x => x.CategoryId));
                eligible = grouped.Where(x => products[x.ProductId].Categories.Any(c => scope.Contains(c.CategoryId)) ||
                    (products[x.ProductId].CategoryId.HasValue && scope.Contains(products[x.ProductId].CategoryId!.Value))).ToList();
            }
            decimal subtotal = eligible.Sum(x => products[x.ProductId].Price * x.Quantity);
            discount = decimal.Floor(subtotal * coupon.DiscountPercent / 100);
            if (coupon.MaxDiscountAmount.HasValue) discount = Math.Min(discount, Math.Max(0, coupon.MaxDiscountAmount.Value));
            if (subtotal == 0) throw new AccountingException("COUPON_NOT_APPLICABLE", 400);
        }
        decimal remaining = discount;
        decimal eligibleNet = eligible.Sum(x => products[x.ProductId].Price * x.Quantity);
        var lines = new List<QuotedLine>();
        Guid? lastEligible = eligible.LastOrDefault()?.ProductId;
        foreach (var item in grouped)
        {
            decimal part = discount == 0 || !eligible.Any(x => x.ProductId == item.ProductId) ? 0 : item.ProductId == lastEligible ? remaining
                : decimal.Floor(discount * (products[item.ProductId].Price * item.Quantity) / eligibleNet);
            remaining -= part; lines.Add(new(products[item.ProductId], item.Quantity, part, policy.SellingPrice(products[item.ProductId].Price), policy.IncludedInPrice ? policy.UnitAmount : 0));
        }
        decimal freight = 0;
        bool undetermined = !policy.IncludedInPrice && string.IsNullOrWhiteSpace(shippingMethod);
        if (!policy.IncludedInPrice && shippingMethod == "post")
        {
            if (!shippingQuoteId.HasValue)
            {
                if (requireShipping) throw new AccountingException("SHIPPING_QUOTE_REQUIRED", 422);
                undetermined = true;
            }
            else
            {
                var saved = await db.ShippingQuotes.AsNoTracking().SingleOrDefaultAsync(x => x.Id == shippingQuoteId && x.UserId == userId && x.AddressId == addressId, ct)
                    ?? throw new AccountingException("SHIPPING_QUOTE_INVALID", 422);
                var address = await db.CustomerAddresses.AsNoTracking().SingleOrDefaultAsync(x => x.Id == addressId && x.UserId == userId, ct)
                    ?? throw new AccountingException("ADDRESS_NOT_FOUND", 404);
                var provisional = new CartQuote(lines, 0, false, policy);
                if (saved.ExpiresAtUtc <= time.GetUtcNow().UtcDateTime || saved.PolicyVersion != policy.Version ||
                    saved.Fingerprint != ShippingUseCases.Fingerprint(policy, address, provisional, saved.DestinationCityCode))
                    throw new AccountingException("SHIPPING_QUOTE_EXPIRED", 409);
                freight = saved.CostToman;
            }
        }
        return new(lines, freight, undetermined, policy);
    }
}
