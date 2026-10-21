using System.Net;
using System.Net.Http.Json;
using Application.Catalog;
using Application.Discussions;
using Domain.Entities;
using Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
using Persistence.Identity;
using Xunit;
using Host = Vendora.IntegrationTests.ProductArticleTests.ArticleHost;

namespace Vendora.IntegrationTests;

/// <summary>Real HTTP, authorization, SQLite migration and aggregation coverage for product discussions.</summary>
public sealed class ProductDiscussionTests
{
    /// <summary>Creates only isolated test users/products and a caller-specific authenticated HTTP client.</summary>
    private static async Task<(Guid Product, Guid User, HttpClient Client)> Setup(Host host, string role = "Customer")
    {
        using var scope = host.App.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = new AppUser { Id = Guid.NewGuid(), FullName = role + " Test", UserName = Guid.NewGuid().ToString(), Email = "test@example.invalid" };
        var product = new Product { Title = "Test bag", Slug = Guid.NewGuid().ToString(), Status = ProductStatus.Active, Price = 100, StockQuantity = 10 };
        db.Users.Add(user); db.Products.Add(product); await db.SaveChangesAsync();
        var client = host.Client(role); client.DefaultRequestHeaders.Add("Test-User", user.Id.ToString());
        return (product.Id, user.Id, client);
    }

    /// <summary>Creates an authoritative order fixture; no client can supply this eligibility flag.</summary>
    private static async Task<Order> Purchase(Host host, Guid product, Guid user, OrderStatus status = OrderStatus.Delivered, PaymentStatus payment = PaymentStatus.Verified)
    {
        using var scope = host.App.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var order = new Order { UserId = user, OrderNumber = Guid.NewGuid().ToString(), Status = status, PaymentStatus = payment,
            Items = [new OrderItem { ProductId = product, ProductTitle = "Test bag", Quantity = 1, UnitPrice = 100 }] };
        db.Orders.Add(order); await db.SaveChangesAsync(); return order;
    }

    [Fact]
    public async Task GuestReads_AuthenticatedText_AndBuyerOnlyRating()
    {
        await using var host = await Host.CreateAsync();
        var (product, user, client) = await Setup(host); using var own = client; using var guest = host.Client(null);
        string root = $"/api/products/{product}/discussion";
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PutAsJsonAsync(root + "/review", new { content = "Text", rating = 5 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await own.PutAsJsonAsync(root + "/review", new { content = "A real comment", rating = (int?)null })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await own.PutAsJsonAsync(root + "/review", new { content = "Fake rating", rating = 5 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await own.PutAsJsonAsync(root + "/review", new { content = "Bad rating", rating = 6 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await own.PutAsJsonAsync(root + "/review", new { content = "   " })).StatusCode);
        await Purchase(host, product, user);
        Assert.Equal(HttpStatusCode.OK, (await own.PutAsJsonAsync(root + "/review", new { content = "Delivered review", rating = 4 })).StatusCode);
        var page = await guest.GetFromJsonAsync<DiscussionQueries.Page>(root);
        var entry = Assert.Single(page!.Items); Assert.True(entry.IsBuyer); Assert.Equal(4, entry.Rating);
        var detail = await guest.GetFromJsonAsync<CatalogQueries.CatalogProductDto>($"/api/catalog/products/{product}");
        Assert.Equal(4, detail!.Rating); Assert.Equal(1, detail.RatingCount); Assert.Equal(1, detail.ReviewCount);
        var json = await guest.GetStringAsync(root); Assert.DoesNotContain("test@example.invalid", json); Assert.DoesNotContain(user.ToString(), json);
        Assert.True((await own.GetFromJsonAsync<DiscussionQueries.Mine>(root + "/me"))!.CanRate);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await own.PutAsJsonAsync(root + "/review", new { content = "Sixth write" })).StatusCode);
    }

    [Theory]
    [InlineData(OrderStatus.PendingPayment, PaymentStatus.Pending)]
    [InlineData(OrderStatus.Paid, PaymentStatus.Verified)]
    [InlineData(OrderStatus.Cancelled, PaymentStatus.Verified)]
    [InlineData(OrderStatus.Refunded, PaymentStatus.Verified)]
    [InlineData(OrderStatus.Delivered, PaymentStatus.Failed)]
    public async Task NonDeliveredOrUnverifiedOrder_NeverGrantsRating(OrderStatus status, PaymentStatus payment)
    {
        await using var host = await Host.CreateAsync(); var (product, user, client) = await Setup(host); using var own = client;
        await Purchase(host, product, user, status, payment);
        Assert.False((await own.GetFromJsonAsync<DiscussionQueries.Mine>($"/api/products/{product}/discussion/me"))!.CanRate);
        Assert.Equal(HttpStatusCode.Forbidden, (await own.PutAsJsonAsync($"/api/products/{product}/discussion/review", new { content = "Review", rating = 5 })).StatusCode);
    }

    [Fact]
    public async Task Moderation_EditingAndOwnership_PreserveStatistics()
    {
        await using var host = await Host.CreateAsync(); var (product, user, client) = await Setup(host); using var own = client;
        var (_, _, otherClient) = await Setup(host); using var other = otherClient;
        using var admin = host.Client("Admin"); using var guest = host.Client(null);
        string root = $"/api/products/{product}/discussion";
        await Purchase(host, product, user);
        await own.PutAsJsonAsync(root + "/review", new { content = "Original", rating = 5 });
        var mine = await own.GetFromJsonAsync<DiscussionQueries.Mine>(root + "/me"); var id = mine!.Review!.Id;
        Assert.Equal(HttpStatusCode.Forbidden, (await other.PatchAsJsonAsync($"/api/admin/discussions/review/{id}/visibility", new { hidden = true })).StatusCode);
        await other.PutAsJsonAsync(root + "/review", new { content = "Different author" });
        await admin.PatchAsJsonAsync($"/api/admin/discussions/review/{id}/visibility", new { hidden = true });
        await own.PutAsJsonAsync(root + "/review", new { content = "Edited but still hidden", rating = 3 });
        var page = await guest.GetFromJsonAsync<DiscussionQueries.Page>(root); Assert.Equal("Different author", Assert.Single(page!.Items).Content);
        var detail = await guest.GetFromJsonAsync<CatalogQueries.CatalogProductDto>($"/api/catalog/products/{product}"); Assert.Equal(0, detail!.RatingCount); Assert.Equal(1, detail.ReviewCount);
        await admin.PatchAsJsonAsync($"/api/admin/discussions/review/{id}/visibility", new { hidden = false });
        detail = await guest.GetFromJsonAsync<CatalogQueries.CatalogProductDto>($"/api/catalog/products/{product}"); Assert.Equal(3, detail!.Rating); Assert.Equal(2, detail.ReviewCount);
        var moderation = await admin.GetFromJsonAsync<DiscussionQueries.Page>($"/api/admin/discussions?kind=review&productId={product}&hidden=false"); Assert.Equal(2, moderation!.Total);
    }

    [Fact]
    public async Task Questions_OfficialAnswers_AndHiddenParents()
    {
        await using var host = await Host.CreateAsync(); var (product, _, client) = await Setup(host); using var own = client;
        var (_, _, adminClient) = await Setup(host,"Admin"); using var admin = adminClient; using var guest = host.Client(null);
        string root = $"/api/products/{product}/discussion";
        Assert.Equal(HttpStatusCode.Created, (await own.PostAsJsonAsync(root + "/questions", new { content = "آیا این کیف ضدآب است؟" })).StatusCode);
        var q = Assert.Single((await guest.GetFromJsonAsync<DiscussionQueries.Page>(root + "?kind=question"))!.Items);
        await own.PostAsJsonAsync(root + $"/questions/{q.Id}/answers", new { content = "Customer answer", isOfficial = true });
        await admin.PostAsJsonAsync(root + $"/questions/{q.Id}/answers", new { content = "Official answer" });
        var answers = await guest.GetFromJsonAsync<DiscussionQueries.Page>(root + $"?kind=answer&questionId={q.Id}");
        Assert.Equal(2, answers!.Total); Assert.Equal("Official answer", Assert.Single(answers.Items, x => x.IsOfficial).Content);
        await admin.PatchAsJsonAsync($"/api/admin/discussions/question/{q.Id}/visibility", new { hidden = true });
        Assert.Empty((await guest.GetFromJsonAsync<DiscussionQueries.Page>(root + "?kind=question"))!.Items);
        Assert.Equal(HttpStatusCode.NotFound, (await guest.GetAsync(root + $"?kind=answer&questionId={q.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await own.PostAsJsonAsync(root + $"/questions/{q.Id}/answers", new { content = "Hidden parent" })).StatusCode);
    }

    [Fact]
    public async Task Pagination_ValidationAndUniqueConstraint()
    {
        await using var host = await Host.CreateAsync(); var (product, user, client) = await Setup(host); using var own = client;
        using (var scope = host.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.ProductQuestions.AddRange(Enumerable.Range(0,12).Select(i => new ProductQuestion {ProductId=product,UserId=user,Content=$"Question {i}"}));
            db.ProductReviews.Add(new ProductReview {ProductId=product,UserId=user,Content="Existing"}); await db.SaveChangesAsync();
            db.ProductReviews.Add(new ProductReview {ProductId=product,UserId=user,Content="Duplicate"});
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        }
        string root = $"/api/products/{product}/discussion";
        var first = await own.GetFromJsonAsync<DiscussionQueries.Page>(root + "?kind=question"); var second = await own.GetFromJsonAsync<DiscussionQueries.Page>(root + "?kind=question&page=2");
        Assert.Equal(12, first!.Total); Assert.Equal(10, first.Items.Count); Assert.Equal(2, second!.Items.Count); Assert.Empty(first.Items.Select(x => x.Id).Intersect(second.Items.Select(x => x.Id)));
        Assert.Equal(HttpStatusCode.BadRequest, (await own.PostAsJsonAsync(root + "/questions", new { content = new string('a',2001) })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await own.PostAsJsonAsync($"/api/products/{Guid.NewGuid()}/discussion/questions", new { content="Unknown" })).StatusCode);
    }

    /// <summary>Multiple purchases never weight a vote twice, and refunded purchases lose their rating effect.</summary>
    [Fact]
    public async Task Average_UsesOneVotePerBuyer_AndRechecksEligibility()
    {
        await using var host = await Host.CreateAsync();
        var (product, user, client) = await Setup(host); using var first = client;
        var (_, other, otherClient) = await Setup(host); using var second = otherClient;
        var purchase = await Purchase(host, product, user);
        var duplicate = await Purchase(host, product, user);
        await Purchase(host, product, other);
        var path = $"/api/products/{product}/discussion/review";
        await first.PutAsJsonAsync(path, new {content="First",rating=5});
        await second.PutAsJsonAsync(path, new {content="<script>alert(1)</script>",rating=2});
        var detail = await first.GetFromJsonAsync<CatalogQueries.CatalogProductDto>($"/api/catalog/products/{product}");
        Assert.Equal(3.5, detail!.Rating); Assert.Equal(2, detail.RatingCount);
        using (var scope = host.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            foreach (var order in await db.Orders.Where(o => o.Id == purchase.Id || o.Id == duplicate.Id).ToListAsync()) order.Status = OrderStatus.Refunded;
            await db.SaveChangesAsync();
        }
        detail = await first.GetFromJsonAsync<CatalogQueries.CatalogProductDto>($"/api/catalog/products/{product}");
        Assert.Equal(2, detail!.Rating); Assert.Equal(1, detail.RatingCount); Assert.Equal(2, detail.ReviewCount);
        var page = await first.GetFromJsonAsync<DiscussionQueries.Page>($"/api/products/{product}/discussion");
        Assert.False(Assert.Single(page!.Items, x => x.Content == "First").IsBuyer);
        Assert.Null(Assert.Single(page.Items, x => x.Content == "First").Rating);
        Assert.Contains(page.Items, x => x.Content == "<script>alert(1)</script>");
    }
}
