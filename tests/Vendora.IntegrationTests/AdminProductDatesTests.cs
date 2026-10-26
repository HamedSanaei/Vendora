using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Domain.Entities;
using Domain.Enums;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Ensures the actual list/detail DTOs expose authoritative UTC audit dates for admin sorting without schema changes.</summary>
public sealed class AdminProductDatesTests
{
    [Fact]
    public async Task ProductListAndDetails_PreserveCreationAndReturnLastEditAsUtc()
    {
        await using var host=await ProductArticleTests.ArticleHost.CreateAsync();
        var product=new Product{Title="Date sorting fixture",Slug="date-sort-fixture",Price=100,Status=ProductStatus.Active};
        using(var scope=host.App.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();db.Products.Add(product);await db.SaveChangesAsync();}
        using var admin=host.Client("Admin");using var response=await admin.GetAsync("/api/admin/products");Assert.Equal(HttpStatusCode.OK,response.StatusCode);
        var rows=await response.Content.ReadFromJsonAsync<JsonElement>();var first=rows.EnumerateArray().Single(row=>row.GetProperty("id").GetGuid()==product.Id);
        var created=first.GetProperty("createdAtUtc");Assert.EndsWith("Z",created.GetString());Assert.Equal(product.CreatedAtUtc,created.GetDateTime());Assert.Equal(JsonValueKind.Null,first.GetProperty("updatedAtUtc").ValueKind);
        using(var scope=host.App.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var row=await db.Products.FindAsync(product.Id);row!.Title="Edited fixture";await db.SaveChangesAsync();}
        var details=await admin.GetFromJsonAsync<JsonElement>($"/api/admin/products/{product.Id}");Assert.Equal(created.GetDateTime(),details.GetProperty("createdAtUtc").GetDateTime());Assert.EndsWith("Z",details.GetProperty("updatedAtUtc").GetString());Assert.True(details.GetProperty("updatedAtUtc").GetDateTime()>=created.GetDateTime());
    }
}
