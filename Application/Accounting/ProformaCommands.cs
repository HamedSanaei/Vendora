using System.Text.Json;
using Domain.Accounting;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;
using Application.Auth;

namespace Application.Accounting;

/// <summary>Issues immutable server-priced customer quotes without reserving stock or recording money.</summary>
public static class ProformaCommands
{
    public sealed record Issue(Guid UserId, string Key, IReadOnlyList<CartQuoteItem> Items, string? ShippingMethod, string? CouponCode, Guid? ShippingQuoteId = null, Guid? AddressId = null) : IRequest<Guid>;

    /// <summary>Snapshots current product/party/seller prices; client prices are comparison values only.</summary>
    public sealed class IssueHandler(AppDbContext db, AccountingUnitOfWork work, CartQuotation pricing, TimeProvider time) : IRequestHandler<Issue, Guid>
    {
        public Task<Guid> Handle(Issue request, CancellationToken ct) => work.ExecuteAsync(request.UserId, request.Key, "cart-proforma", request,
            async token =>
            {
                await CustomerProfile.RequireAsync(db, request.UserId, token);
                var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.UserId, token)
                    ?? throw new AccountingException("USER_NOT_FOUND", 401);
                var quote = await pricing.QuoteAsync(request.Items, request.ShippingMethod, request.CouponCode, token, request.ShippingQuoteId, request.UserId, request.AddressId);
                var address = request.AddressId.HasValue
                    ? await db.CustomerAddresses.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.AddressId && x.UserId == user.Id, token)
                        ?? throw new AccountingException("ADDRESS_NOT_FOUND", 404)
                    : await db.CustomerAddresses.AsNoTracking().Where(x => x.UserId == user.Id)
                        .OrderByDescending(x => x.IsDefault).ThenBy(x => x.Id).FirstOrDefaultAsync(token);
                var party = await db.Counterparties.SingleOrDefaultAsync(x => x.UserId == user.Id, token);
                if (party is null)
                {
                    party = new Counterparty { UserId = user.Id, Name = user.FullName, Phone = user.PhoneNumber ?? "",
                        Address = address?.StreetAddress ?? "", Role = CounterpartyRole.Customer };
                    db.Counterparties.Add(party);
                }
                var document = new FinancialDocument(await work.NextNumberAsync(DocumentKind.Proforma, token), DocumentKind.Proforma,
                    DocumentCurrency.Toman, 1, party.Id, user.Id, time.GetUtcNow().UtcDateTime, customerUserId: user.Id);
                document.SetDraftContent(quote.Lines.Select(x => new FinancialDocumentLine(document.Id, x.Product.Id,
                    x.Product.ProductCode, x.Product.Title, x.Quantity, x.UnitPrice, x.Discount, 0, baseUnitPrice: x.Product.Price, embeddedShippingUnitAmount: x.EmbeddedShippingUnitAmount)), quote.Freight, false,
                    "قیمت‌ها مربوط به زمان صدور است؛ این سند رسید پرداخت، تضمین قیمت یا رزرو موجودی نیست.",
                    await DocumentCommands.SellerSnapshotAsync(db, token),
                    JsonSerializer.Serialize(new PartySnapshot(user.FullName, user.PhoneNumber ?? "",
                        address is null ? "" : $"{address.Province}، {address.City}، {address.StreetAddress}، {address.PostalCode}",
                        ShippingTerms: Application.Shipping.ShippingPricing.Terms(request.ShippingMethod, quote.Policy.IncludedInPrice), ShippingPolicyVersion: quote.Policy.Version, EmbeddedShippingUnitAmount: quote.Policy.IncludedInPrice ? quote.Policy.UnitAmount : 0)), quote.ShippingUndetermined);
                document.Post(time.GetUtcNow().UtcDateTime); db.FinancialDocuments.Add(document); return document.Id;
            }, ct);
    }

    /// <summary>Snapshots validated shipping terms rather than inferring free shipping from a zero online charge.</summary>
    internal static string ShippingTerms(string? shippingMethod) => shippingMethod switch
    {
        "post" => "پست پیشتاز؛ پیش‌پرداخت کرایه",
        "tipax" => "تیپاکس؛ پیش‌پرداخت کرایه",
        "freight" => "باربری همراه بیمه؛ پرداخت کرایه هنگام تحویل",
        _ => "کرایه در مرحلهٔ ارسال تعیین می‌شود"
    };
}
