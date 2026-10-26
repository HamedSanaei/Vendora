using Application.Accounting;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Shipping;

/// <summary>One database-backed policy source shared by catalog, cart, orders and documents.</summary>
public static class ShippingPricing
{
    /// <summary>Reads defaults without creating state on public requests.</summary>
    public static async Task<ShippingPolicy> ReadAsync(AppDbContext db, CancellationToken ct)
        => await db.ShippingPolicies.AsNoTracking().SingleOrDefaultAsync(x => x.Id == 1, ct) ?? new ShippingPolicy();

    /// <summary>Validates explicit methods and total unit count; distinct SKU count is never used.</summary>
    public static void ValidateMethod(string? method, int count)
    {
        if (method is not (null or "" or "post" or "tipax" or "freight")) throw new AccountingException("INVALID_SHIPPING_METHOD", 400);
        if (method == "freight" && count <= 10) throw new AccountingException("FREIGHT_MIN_QUANTITY", 400);
    }

    /// <summary>Produces immutable human-readable delivery terms without equating zero online charge with free delivery.</summary>
    public static string Terms(string? method, bool included) => method switch
    {
        "post" => included ? "پست پیشتاز؛ ارسال رایگان" : "پست پیشتاز؛ پیش‌پرداخت کرایه استعلام‌شده",
        "tipax" => included ? "تیپاکس؛ ارسال رایگان" : "تیپاکس؛ پرداخت کرایه هنگام تحویل",
        "freight" => included ? "باربری؛ ارسال رایگان" : "باربری؛ پرداخت کرایه هنگام تحویل",
        _ => included ? "ارسال رایگان؛ روش در مرحلهٔ ارسال انتخاب می‌شود" : "کرایه در مرحلهٔ ارسال تعیین می‌شود"
    };
}
