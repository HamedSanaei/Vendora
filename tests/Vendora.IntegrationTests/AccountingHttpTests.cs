using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Accounting;
using Application.Interfaces;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Documents;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Persistence;
using Persistence.Identity;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Exercises actual authenticated HTTP + MediatR + SQLite + QuestPDF, using isolated test identities and evidence.</summary>
public sealed class AccountingHttpTests
{
    /// <summary>Issuance/download are owner checked, retry-safe and retain collect-freight terms without leaking costs.</summary>
    [Fact]
    public async Task ProformaHttp_RealPdf_Ownership_Idempotency_AndCollectFreight()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync(services =>
        {
            services.AddScoped<AccountingUnitOfWork>(); services.AddScoped<CartQuotation>();
            services.AddScoped<ICommercialDocumentRenderer>(sp => new QuestCommercialDocumentRenderer(
                new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Accounting:Pdf:License"] = "Community" }).Build(),
                sp.GetRequiredService<IHostEnvironment>(), NullLogger<QuestCommercialDocumentRenderer>.Instance));
        });
        var user = new AppUser { FirstName = "خریدار", LastName = "آزمایشی", Email = "buyer@example.invalid", PhoneNumber = "09121111111", PhoneNumberConfirmed = true, FullName = "خریدار آزمایشی", UserName = Guid.NewGuid().ToString() };
        var product = new Product { Title = "کیف آزمایشی", Slug = Guid.NewGuid().ToString(), Price = 1250000, StockQuantity = 3, Status = ProductStatus.Active };
        using (var scope = host.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.AddRange(user, product); await db.SaveChangesAsync();
        }
        using var client = host.Client("Customer"); client.DefaultRequestHeaders.Add("Test-User", user.Id.ToString());
        client.DefaultRequestHeaders.Add("Idempotency-Key", "http-proforma-same-key");
        var request = new API.Controllers.CustomerDocumentsController.ProformaRequest([new(product.Id, 2, 1250000)], "freight");
        using var issued = await client.PostAsJsonAsync("/api/account/documents/proformas", request);
        Assert.Equal(HttpStatusCode.OK, issued.StatusCode);
        var id = (await issued.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid();
        using var retried = await client.PostAsJsonAsync("/api/account/documents/proformas", request);
        Assert.Equal(id, (await retried.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetGuid());
        using var changed = await client.PostAsJsonAsync("/api/account/documents/proformas", request with { Items = [new(product.Id, 1, 1250000)] });
        Assert.Equal(HttpStatusCode.Conflict, changed.StatusCode);
        using var pdf = await client.GetAsync($"/api/account/documents/{id}/pdf?size=A5");
        Assert.Equal(HttpStatusCode.OK, pdf.StatusCode);
        Assert.Equal("application/pdf", pdf.Content.Headers.ContentType?.MediaType);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString((await pdf.Content.ReadAsByteArrayAsync())[..4]));
        Assert.True(pdf.Headers.CacheControl?.NoStore);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/account/documents/{id}/pdf?size=999")).StatusCode);
        using var foreign = host.Client("Customer"); foreign.DefaultRequestHeaders.Add("Test-User", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.NotFound, (await foreign.GetAsync($"/api/account/documents/{id}/pdf")).StatusCode);
        using var guest = host.Client(null);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync($"/api/account/documents/{id}/pdf")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/admin/accounting/documents/{id}/pdf")).StatusCode);
        string json = await client.GetStringAsync($"/api/account/documents/{id}");
        Assert.DoesNotContain("costToman", json, StringComparison.OrdinalIgnoreCase);
        var own = JsonSerializer.Deserialize<CustomerDocumentDto>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        var buyer = JsonSerializer.Deserialize<Domain.Accounting.PartySnapshot>(own.BuyerSnapshotJson)!;
        Assert.Contains("هنگام تحویل", buyer.ShippingTerms);
        Assert.Equal(2500000, own.TotalToman); Assert.Equal(0, own.Freight); Assert.False(own.ShippingUndetermined);
        using var verifyScope = host.App.Services.CreateScope();
        var verify = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await verify.StockMovements.ToListAsync()); Assert.Empty(await verify.PartyLedgerEntries.ToListAsync());
        Assert.Equal(3, (await verify.Products.SingleAsync(x => x.Id == product.Id)).StockQuantity);
    }
}
