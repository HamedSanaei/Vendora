using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using API.Controllers;
using Application.Catalog;
using Application.Interfaces;
using Application.Products.DTOs;
using Application.Seo;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Content;
using Infrastructure.Seo;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Exercises the real SQLite/API category, alias, assessment and launch policies without external services.</summary>
public sealed class CatalogSeoTests
{
    /// <summary>Four levels, multiple roots and malformed cycles remain finite and preserve explicit selections.</summary>
    [Fact]
    public void Hierarchy_IsCycleSafeAndBranchAware()
    {
        var root = Category("root"); var child = Category("child", root.Id);
        var grand = Category("grand", child.Id); var leaf = Category("leaf", grand.Id); var other = Category("other");
        var tree = new CategoryHierarchy([root, child, grand, leaf, other]);
        Assert.Equal(4, tree.Descendants([root.Id]).Count);
        Assert.Equal(new[] { root.Id, child.Id, grand.Id, leaf.Id }, tree.Path(leaf.Id).Select(x => x.Id));
        child.IsActive = false;
        Assert.False(tree.IsPublic(leaf.Id));
        Assert.Single(tree.Descendants([root.Id], true));
        child.IsActive = true; root.ParentCategoryId = leaf.Id;
        Assert.False(tree.IsPublic(root.Id));
        Assert.Equal(4, tree.Descendants([root.Id]).Count);
        Assert.True(tree.IsPublic(other.Id));
    }

    /// <summary>Parent filters include grandchildren with OR semantics, unique counts, exact price sort and bounded pagination.</summary>
    [Fact]
    public async Task Search_IncludesDescendantsWithoutDuplicateProducts()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var scope = host.App.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var root = Category("root"); var child = Category("child", root.Id); var grand = Category("grand", child.Id);
        var leaf = Category("leaf", grand.Id); var other = Category("other");
        var first = Product("one", leaf.Id, 300_000m); var second = Product("two", other.Id, 100_000m);
        first.Categories.Add(new ProductCategory { CategoryId = leaf.Id });
        first.Categories.Add(new ProductCategory { CategoryId = child.Id });
        db.AddRange(root, child, grand, leaf, other, first, second); await db.SaveChangesAsync();
        using var client = host.Client("Admin");
        var result = (await client.GetFromJsonAsync<CatalogSearch.PageResult>("/api/catalog/products/search?category=root&category=child&pageSize=1"))!;
        Assert.Equal(1, result.Total); Assert.Equal(first.Id, Assert.Single(result.Products).Id);
        Assert.Equal(2, await db.ProductCategories.CountAsync(x => x.ProductId == first.Id));
        result = (await client.GetFromJsonAsync<CatalogSearch.PageResult>("/api/catalog/products/search?category=root&category=other&sort=priceAsc&pageSize=1&page=2"))!;
        Assert.Equal(2, result.Total); Assert.Equal(first.Id, Assert.Single(result.Products).Id); Assert.Equal(2, result.Page);
        var searched = (await client.GetFromJsonAsync<CatalogSearch.PageResult>("/api/catalog/products/search?search=ONE"))!;
        Assert.Equal(first.Id, Assert.Single(searched.Products).Id);
        result = (await client.GetFromJsonAsync<CatalogSearch.PageResult>("/api/catalog/products/search?baseCategory=root&category=other"))!;
        Assert.Empty(result.Products);
        child.IsActive = false; await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/catalog/categories/leaf")).StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<CatalogSearch.PageResult>("/api/catalog/products/search?category=root"))!.Products);
        Assert.Equal(2, (await client.GetFromJsonAsync<CatalogSearch.PageResult>("/api/catalog/products/search"))!.Total);
        var tree = (await client.GetFromJsonAsync<CatalogQueries.CatalogCategoryDto[]>("/api/catalog/categories/tree"))!;
        Assert.Empty(tree.Single(x => x.Slug == "root").Children);
    }

    /// <summary>The category editor preserves metadata when old clients omit new fields and rejects reparenting cycles.</summary>
    [Fact]
    public async Task Category_ContentSlugAndCycleValidation_RoundTrip()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var client = host.Client("Admin");
        var body = new { name = "کیف سفر", slug = "کیف-سفر", parentCategoryId = host.CategoryId, isActive = true,
            description = "<h2>سفر</h2><p>معرفی کیف</p><script>bad()</script>", imageUrl = (string?)null,
            seo = new SeoInput(Title: "عنوان اختصاصی دسته", Description: "توضیحات اختصاصی دسته", FocusKeyphrase: "کیف سفر") };
        var created = await client.PostAsJsonAsync("/api/admin/categories", body);
        Assert.True(created.IsSuccessStatusCode, await created.Content.ReadAsStringAsync());
        var category = (await created.Content.ReadFromJsonAsync<Application.Admin.DTOs.AdminCategoryDto>())!;
        Assert.NotNull(category.Seo?.Score); Assert.DoesNotContain("<script", category.Description!);
        var cycle = await client.PutAsJsonAsync($"/api/admin/categories/{host.CategoryId}", new {name="Root",slug="test-bags",parentCategoryId=category.Id,isActive=true});
        Assert.Equal(HttpStatusCode.BadRequest, cycle.StatusCode);
        var updated = await client.PutAsJsonAsync($"/api/admin/categories/{category.Id}", new {name=body.name,slug="سفر-جدید",parentCategoryId=host.CategoryId,isActive=true});
        Assert.True(updated.IsSuccessStatusCode, await updated.Content.ReadAsStringAsync());
        var value = (await updated.Content.ReadFromJsonAsync<Application.Admin.DTOs.AdminCategoryDto>())!;
        Assert.Equal(body.seo.Title, value.Seo!.Fields.Title); Assert.Equal(category.Description, value.Description);
        var redirect = (await client.GetFromJsonAsync<SeoQueries.RedirectResult>("/api/catalog/seo/redirect?path=" + Uri.EscapeDataString("/fa/category/کیف-سفر")))!;
        Assert.Equal("/fa/category/سفر-جدید", redirect.Location); Assert.Equal(301, redirect.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/admin/categories", body)).StatusCode);
        var landing = (await client.GetFromJsonAsync<CatalogSearch.CategoryDetail>("/api/catalog/categories/" + Uri.EscapeDataString(value.Slug)))!;
        Assert.Equal(2, landing.Breadcrumbs.Count); Assert.Contains("<h2>", landing.DescriptionHtml!);
        var oversized = await client.PostAsJsonAsync("/api/admin/categories",new {name="Too large",slug="too-large",isActive=true,description="<p>"+new string('&',50_000)+"</p>"});
        Assert.Equal(HttpStatusCode.BadRequest,oversized.StatusCode);
    }

    /// <summary>SEO survives omitted multipart fields, custom image alt is stable, primary category and GUID identity are preserved.</summary>
    [Fact]
    public async Task Product_SeoAltPrimaryCategoryAndAliases_AreCompatible()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var client = host.Client("Admin");
        using var scope = host.App.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var other = Category("zzz"); db.Add(other); await db.SaveChangesAsync();
        using var create = Body("کیف-روزمره", host.CategoryId, other.Id, includeSeo:true);
        var response = await client.PostAsync("/api/admin/products", create);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        var saved = (await response.Content.ReadFromJsonAsync<AdminProductDto>())!;
        Assert.Equal(other.Id, saved.CategoryId); Assert.Equal(2, saved.Categories.Count);
        var image = new ProductImage {ProductId=saved.Id,ImageUrl="/uploads/products/0123456789abcdef0123456789abcdef.png",AltText="نمای پشت کیف",IsPrimary=true};
        db.ProductImages.Add(image); await db.SaveChangesAsync();
        using var edit = Body("کیف-جدید", host.CategoryId, other.Id);
        response = await client.PutAsync($"/api/admin/products/{saved.Id}", edit);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        var changed = (await response.Content.ReadFromJsonAsync<AdminProductDto>())!;
        Assert.Equal(saved.Id, changed.Id); Assert.Equal(saved.Seo!.Fields.Title, changed.Seo!.Fields.Title);
        Assert.Equal("نمای پشت کیف", Assert.Single(changed.Images).AltText);
        Assert.Equal(SeoAnalyzer.Version, changed.Seo.AnalysisVersion);
        using var altEdit = Body("کیف-جدید",host.CategoryId,other.Id);
        altEdit.Add(new StringContent(JsonSerializer.Serialize(new[]{new{id=image.Id,alt="نمای سفارشی جدید"}})),"ImageAltsJson");
        var altResponse=await client.PutAsync($"/api/admin/products/{saved.Id}",altEdit);
        Assert.True(altResponse.IsSuccessStatusCode,await altResponse.Content.ReadAsStringAsync());
        Assert.Equal("نمای سفارشی جدید",Assert.Single((await altResponse.Content.ReadFromJsonAsync<AdminProductDto>())!.Images).AltText);
        var detail = (await client.GetFromJsonAsync<CatalogQueries.CatalogProductDto>("/api/catalog/products/" + Uri.EscapeDataString("کیف-روزمره")))!;
        Assert.Equal(saved.Id, detail.Id); Assert.Equal("zzz", detail.Breadcrumbs![0].Slug);
        var redirect = (await client.GetFromJsonAsync<SeoQueries.RedirectResult>("/api/catalog/seo/redirect?path=" + Uri.EscapeDataString($"/fa/product-details/{saved.Id}")))!;
        Assert.Equal("/fa/product/کیف-جدید", redirect.Location); Assert.Equal(301, redirect.StatusCode);
        using var reserved = Body("کیف-روزمره",host.CategoryId,other.Id);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/admin/products",reserved)).StatusCode);
        using var idCollision=Body(saved.Id.ToString(),host.CategoryId,other.Id);
        Assert.Equal(HttpStatusCode.BadRequest,(await client.PostAsync("/api/admin/products",idCollision)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await client.GetAsync("/api/catalog/products/missing-product")).StatusCode);
    }

    /// <summary>Manual redirects reject open/private paths and cycles, including loops through automatic slug aliases.</summary>
    [Fact]
    public async Task Redirects_RejectLoopsAndFlattenChains()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var client = host.Client("Admin");
        using var scope = host.App.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var product = Product("current",host.CategoryId);
        db.Add(product); db.SlugHistories.Add(new SlugHistory {Kind="product",EntityId=product.Id,Slug="old"}); await db.SaveChangesAsync();
        async Task<HttpResponseMessage> Save(string from,string to) => await client.PostAsJsonAsync("/api/admin/seo/redirects",new SeoQueries.SaveRedirect(null,from,to,301,true));
        Assert.True((await Save("/fa/about/a","/fa/about/b")).IsSuccessStatusCode);
        Assert.True((await Save("/fa/about/b","/fa/product/old")).IsSuccessStatusCode);
        var resolved = (await client.GetFromJsonAsync<SeoQueries.RedirectResult>("/api/catalog/seo/redirect?path=/fa/about/a"))!;
        Assert.Equal("/fa/product/current", resolved.Location);
        Assert.Equal(HttpStatusCode.BadRequest,(await Save("/fa/product/current","/fa/about/a")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await Save("/fa/about/a","/fa/about/c")).StatusCode);
        foreach (string target in new[]{"https://evil.test","//evil.test","/fa/account","/fa/shop?x=1","/fa/about/../account"})
            Assert.Equal(HttpStatusCode.BadRequest,(await Save("/fa/about/x",target)).StatusCode);
    }

    /// <summary>Weights are fixed/versioned and Persian matching ignores character variants, diacritics and half spaces.</summary>
    [Fact]
    public void Analysis_NormalizesPersianAndScoresAllGroups()
    {
        Assert.Equal(SeoAnalyzer.Normalize("کِیف‌روزمره"),SeoAnalyzer.Normalize("كيف روزمره"));
        Assert.Equal(SeoAnalyzer.Normalize("کیف روزمره،"),SeoAnalyzer.Normalize("كيف روزمره"));
        var settings = new SeoSettings {SiteUrl="https://store.test",IsIndexingEnabled=true};
        string title = "کیف روزمره با طراحی کاربردی و دوام مناسب";
        string meta = "کیف روزمره " + new string('ب',120);
        string article = "<h2>كيف روزمره</h2><p>کیف‌روزمره " + string.Join(' ',Enumerable.Repeat("کاربردی",155)) + "</p><a href='/fa/shop'>فروشگاه</a>";
        var draft = new SeoDraft("product",null,"کیف روزمره","کیف-روزمره",article,new SeoInput(Title:title,Description:meta,FocusKeyphrase:"کيف روزمره"),[new("/uploads/products/x.png","نمای کیف")]);
        var result = SeoAnalyzer.Analyze(draft,settings,new ProductDescriptionService());
        Assert.Equal(100,result.Score); Assert.Equal(100,result.Checks.Sum(x=>x.Maximum)); Assert.Equal(SeoAnalyzer.Version,result.Version);
        Assert.Empty(result.TechnicalWarnings); Assert.True(result.Readability.LongSentences > 0);
        var less = SeoAnalyzer.Analyze(draft with {Images=[],Seo=new SeoInput(Index:false)},WithIndex(false),new ProductDescriptionService(),false,false);
        Assert.True(less.Score < 100); Assert.Equal(2,less.TechnicalWarnings.Count);
    }

    /// <summary>Launch is opt-in, English/private/facet URLs never enter the sitemap, and hidden branches stay out.</summary>
    [Fact]
    public async Task LaunchGate_SitemapAndDuplicateChecks_UseRealData()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var client = host.Client("Admin");
        Assert.Empty((await client.GetFromJsonAsync<SitemapEntry[]>("/api/catalog/seo/sitemap"))!);
        using var scope = host.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var visible = Product("visible",host.CategoryId); visible.Seo=new SeoMetadata {Title="عنوان تکراری",Description="متای تکراری"};
        var hidden = Product("hidden",host.CategoryId); hidden.Seo=new SeoMetadata {Index=false};
        var draft = Product("draft",host.CategoryId); draft.Status=ProductStatus.Draft;
        var parent = Category("hidden-parent"); parent.IsActive=false; var child=Category("hidden-child",parent.Id);
        db.AddRange(visible,hidden,draft,parent,child); await db.SaveChangesAsync();
        var preview = await client.PostAsJsonAsync("/api/admin/seo/analyze",new SeoDraft("category",null,"محتوا","draft","متن",new SeoInput(Title:"عنوان تکراری",Description:"متای تکراری")));
        var analysis=(await preview.Content.ReadFromJsonAsync<SeoAnalysis>())!;
        Assert.Equal(0,analysis.Checks.Single(x=>x.Code=="uniqueTitle").Points);
        Assert.Equal(0,analysis.Checks.Single(x=>x.Code=="uniqueDescription").Points);
        Assert.True((await client.PutAsJsonAsync("/api/admin/seo/settings",new SiteSeoDto("وندورا","https://store.test","{title} | {siteName}",true))).IsSuccessStatusCode);
        var map=(await client.GetFromJsonAsync<SitemapEntry[]>("/api/catalog/seo/sitemap"))!;
        Assert.Contains(map,x=>x.Path=="/fa/product/visible");
        Assert.DoesNotContain(map,x=>x.Path.Contains("hidden") || x.Path.Contains("draft") || x.Path.StartsWith("/en") || x.Path.Contains('?'));
        var models=(await client.GetFromJsonAsync<SeoAi.ModelsResult>("/api/admin/seo/ai/models"))!;
        Assert.False(models.Configured); Assert.Empty(models.Models);
        var unavailable=await client.PostAsJsonAsync("/api/admin/seo/ai/suggest",new SeoSuggestionRequest("metadata",new("product",visible.Id,"کیف","visible","متن",null)));
        Assert.Equal(HttpStatusCode.ServiceUnavailable,unavailable.StatusCode);
        await db.Entry(visible).ReloadAsync(); Assert.Equal("عنوان تکراری",visible.Seo!.Title);
    }

    /// <summary>All editorial settings/analysis are authorized on the server.</summary>
    [Theory]
    [InlineData(null,HttpStatusCode.Unauthorized)]
    [InlineData("Customer",HttpStatusCode.Forbidden)]
    public async Task Seo_RequiresAdministrator(string? role,HttpStatusCode expected)
    {
        await using var host=await ProductArticleTests.ArticleHost.CreateAsync(); using var client=host.Client(role);
        Assert.Equal(expected,(await client.GetAsync("/api/admin/seo/settings")).StatusCode);
        Assert.Equal(expected,(await client.PostAsJsonAsync("/api/admin/seo/analyze",new SeoDraft("product",null,"کیف","bag","متن",null))).StatusCode);
    }

    /// <summary>Only five explicit inference requests per minute are admitted; analysis never consumes the inference gate.</summary>
    [Fact]
    public async Task Ai_IsBoundedAdvisoryAndDoesNotForwardPrivateIdentity()
    {
        var clock=new Clock(); var gate=new SeoAiRateGate(clock); var gateway=new FakeGateway();
        var handler=new SeoAi.SuggestHandler(gateway,gate,new ProductDescriptionService());
        var draft=new SeoDraft("product",Guid.NewGuid(),"کیف","bag","<p>متن عمومی</p>",new SeoInput(CanonicalUrl:"https://store.test",SocialImageUrl:"https://store.test/image.png"),[new("private-image","alt")]);
        for(int i=0;i<5;i++) Assert.Equal(200,(await handler.Handle(new("admin","metadata",draft),default)).Status);
        Assert.Equal(429,(await handler.Handle(new("admin","metadata",draft),default)).Status);
        Assert.Equal(5,gateway.Calls); Assert.Null(gateway.Last!.Id); Assert.Empty(gateway.Last.Images!);
        Assert.Null(gateway.Last.Seo!.CanonicalUrl); Assert.Null(gateway.Last.Seo.SocialImageUrl);
        clock.Now=clock.Now.AddSeconds(61);
        gateway.Fail=true;
        Assert.Equal(503,(await handler.Handle(new("admin","metadata",draft),default)).Status);
        Assert.Equal(400,(await handler.Handle(new("admin","metadata",draft with {Content=new string('x',24001)}),default)).Status);
    }

    /// <summary>Malformed provider responses fail closed, without disclosing configuration or accepting fabricated structure.</summary>
    [Theory]
    [InlineData("{}")]
    [InlineData("{\"choices\":[]}")]
    [InlineData("{\"choices\":[{\"message\":{\"content\":42}}]}")]
    public async Task NineRouter_RejectsInvalidResponses(string json)
    {
        var config=new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?> {
            ["SeoAi:BaseUrl"]="https://router.test/v1",["SeoAi:ApiKey"]="test-only-noncredential",["SeoAi:Model"]="configured-model"}).Build();
        var transport=new Transport(json); var gateway=new NineRouterSeoGateway(transport,config);
        Assert.True(gateway.IsConfigured);
        await Assert.ThrowsAsync<InvalidOperationException>(()=>gateway.SuggestAsync("metadata",new("product",null,"کیف","bag","متن",null),default));
        Assert.Equal("https://router.test/v1/chat/completions",transport.Path);
        Assert.DoesNotContain("fallback",transport.Body!);
    }

    /// <summary>Creates an unsaved hierarchy fixture with stable explicit parent IDs.</summary>
    private static Category Category(string slug,Guid? parent=null)=>new(){Name=slug,Slug=slug,ParentCategoryId=parent,IsActive=true};
    /// <summary>Creates an unsaved public product, without implicitly attaching ancestors.</summary>
    private static Product Product(string slug,Guid category,decimal price=200_000m)=>new(){Title=slug,Slug=slug,CategoryId=category,Price=price,StockQuantity=4,Status=ProductStatus.Active};
    /// <summary>Constructs the same multipart contract used by old and new admin clients.</summary>
    private static MultipartFormDataContent Body(string slug,Guid category,Guid primary,bool includeSeo=false)
    {
        var body=new MultipartFormDataContent();
        foreach(var (key,value) in new[]{("title","کیف روزمره"),("slug",slug),("price","250000"),("stockQuantity","4"),("status","Active"),("categoryId",primary.ToString()),("categoryIds",category.ToString()),("categoryIds",primary.ToString()),("description","<h2>کیف</h2><p>معرفی محصول</p>")})
            body.Add(new StringContent(value),key);
        if(includeSeo) body.Add(new StringContent(JsonSerializer.Serialize(new SeoInput(Title:"عنوان اختصاصی محصول",Description:"توضیحات اختصاصی",FocusKeyphrase:"کیف"))),"SeoJson");
        return body;
    }
    /// <summary>Creates prelaunch settings without mutating a shared fixture.</summary>
    private static SeoSettings WithIndex(bool enabled)=>new(){IsIndexingEnabled=enabled};
    private sealed class Clock:TimeProvider {public DateTimeOffset Now=DateTimeOffset.UtcNow;public override DateTimeOffset GetUtcNow()=>Now;}
    private sealed class FakeGateway:ISeoAiGateway
    {
        public bool IsConfigured=>true; public int Calls; public bool Fail;public SeoDraft? Last;
        public Task<IReadOnlyList<string>> GetModelsAsync(CancellationToken ct)=>Task.FromResult<IReadOnlyList<string>>(["configured"]);
        public Task<SeoAiSuggestion> SuggestAsync(string operation,SeoDraft draft,CancellationToken ct)
        {Calls++;Last=draft;if(Fail)throw new InvalidOperationException("invalid response");return Task.FromResult(new SeoAiSuggestion("عنوان","توضیح",null,[]));}
    }
    private sealed class Transport(string json):HttpMessageHandler,IHttpClientFactory
    {
        public string? Path;public string? Body;
        public HttpClient CreateClient(string name)=>new(this,false);
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,CancellationToken ct)
        {Path=request.RequestUri!.ToString();Body=await request.Content!.ReadAsStringAsync(ct);return new(HttpStatusCode.OK){Content=new StringContent(json,Encoding.UTF8,"application/json")};}
    }
}
