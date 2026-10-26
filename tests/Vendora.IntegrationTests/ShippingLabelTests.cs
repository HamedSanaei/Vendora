using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Interfaces;
using Application.Orders;
using Application.StoreSettings;
using Domain.Entities;
using Domain.Enums;
using Infrastructure.Documents;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Persistence;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Real HTTP/SQLite authorization and real Persian QuestPDF labels; no external services or production records.</summary>
public sealed class ShippingLabelTests
{
    [Fact]
    public async Task AdminOnlyPdf_PreservesSelectionAndOrderSnapshots_WithoutMutations()
    {
        var capture = new CaptureRenderer(); await using var host = await Host(capture);
        var ids = await Seed(host);
        using var guest = host.Client(null); using var customer = host.Client("Customer"); using var admin = host.Client("Admin");
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync($"/api/admin/orders/{ids[0]}/shipping-label/pdf")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.PostAsJsonAsync("/api/admin/orders/shipping-labels/pdf", new { orderIds = ids })).StatusCode);
        using var single = await admin.GetAsync($"/api/admin/orders/{ids[0]}/shipping-label/pdf");
        Assert.Equal(HttpStatusCode.OK, single.StatusCode); Assert.Equal("application/pdf", single.Content.Headers.ContentType?.MediaType);
        Assert.True(single.Headers.CacheControl?.NoStore); Assert.Single(capture.Labels); Assert.Equal("گیرنده ثبت‌شده سفارش", capture.Labels[0].RecipientName);
        Assert.Equal("فرستنده جاری", capture.Labels[0].SenderName); Assert.Equal("رایگان", capture.Labels[0].ShippingTerms);
        using var batch = await admin.PostAsJsonAsync("/api/admin/orders/shipping-labels/pdf", new { orderIds = new[] { ids[1],ids[0],ids[1] } });
        Assert.Equal(HttpStatusCode.OK, batch.StatusCode); Assert.Equal(new[] { ids[1],ids[0] }, capture.Labels.Select(x=>x.OrderId));
        Assert.Equal("پرداخت هنگام تحویل", capture.Labels[0].ShippingTerms);
        Assert.Equal("%PDF", System.Text.Encoding.ASCII.GetString(await batch.Content.ReadAsByteArrayAsync(),0,4));
        Assert.DoesNotContain(typeof(ShippingLabelData).GetProperties(), p=>new[] { "Price","TotalAmount","Items","Email","Latitude","Longitude","PaymentStatus" }.Contains(p.Name));
        using var scope=host.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.All(await db.Orders.ToListAsync(), order=>{Assert.Equal(OrderStatus.PendingPayment,order.Status);Assert.Equal(PaymentStatus.Pending,order.PaymentStatus);Assert.Equal(987654321m,order.TotalAmount);});
        Assert.Empty(await db.StockMovements.ToListAsync());Assert.Empty(await db.FinancialDocuments.ToListAsync());
    }

    [Fact]
    public async Task Validation_IsAllOrNothingAndFieldSpecific_AndDoesNotFabricateHistoricalTerms()
    {
        var capture=new CaptureRenderer();await using var host=await Host(capture);var ids=await Seed(host);using var admin=host.Client("Admin");
        Assert.Equal(HttpStatusCode.BadRequest,(await admin.PostAsJsonAsync("/api/admin/orders/shipping-labels/pdf",new{orderIds=Array.Empty<Guid>()})).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,(await admin.PostAsJsonAsync("/api/admin/orders/shipping-labels/pdf",new{orderIds=Enumerable.Range(0,101).Select(_=>Guid.NewGuid()).ToArray()})).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await admin.PostAsJsonAsync("/api/admin/orders/shipping-labels/pdf",new{orderIds=new[]{ids[0],Guid.NewGuid()}})).StatusCode);Assert.Equal(0,capture.Calls);
        using(var scope=host.App.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var order=await db.Orders.FindAsync(ids[1]);order!.ShippingPostalCode="";await db.SaveChangesAsync();}
        var failed=await admin.PostAsJsonAsync("/api/admin/orders/shipping-labels/pdf",new{orderIds=ids});Assert.Equal(HttpStatusCode.UnprocessableEntity,failed.StatusCode);
        var error=await failed.Content.ReadFromJsonAsync<JsonElement>();Assert.Equal("LABEL_RECIPIENT_INCOMPLETE",error.GetProperty("code").GetString());Assert.Equal("VD-101",error.GetProperty("orderNumber").GetString());Assert.Contains("postalCode",await failed.Content.ReadAsStringAsync());Assert.Equal(0,capture.Calls);
        using(var scope=host.App.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var order=await db.Orders.FindAsync(ids[1]);order!.ShippingPostalCode="1234567890";order.ShippingPolicySnapshotJson="invalid historical JSON";await db.SaveChangesAsync();}
        Assert.Equal(HttpStatusCode.OK,(await admin.GetAsync($"/api/admin/orders/{ids[1]}/shipping-label/pdf")).StatusCode);Assert.Equal("ثبت نشده",capture.Labels[0].ShippingTerms);
        foreach(string snapshot in new[]{"[]","null","{\"IncludedInPrice\":\"false\"}"})
        {
            using(var scope=host.App.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();(await db.Orders.FindAsync(ids[1]))!.ShippingPolicySnapshotJson=snapshot;await db.SaveChangesAsync();}
            Assert.Equal(HttpStatusCode.OK,(await admin.GetAsync($"/api/admin/orders/{ids[1]}/shipping-label/pdf")).StatusCode);Assert.Equal("ثبت نشده",capture.Labels[0].ShippingTerms);
        }
        using(var scope=host.App.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var settings=await db.SeoSettings.SingleAsync();settings.StoreProfileJson="{}";await db.SaveChangesAsync();}
        failed=await admin.GetAsync($"/api/admin/orders/{ids[0]}/shipping-label/pdf");Assert.Equal(HttpStatusCode.UnprocessableEntity,failed.StatusCode);Assert.Contains("LABEL_SENDER_INCOMPLETE",await failed.Content.ReadAsStringAsync());Assert.Equal(4,capture.Calls);
    }

    [Theory]
    [InlineData("single",1)]
    [InlineData("multiple",3)]
    [InlineData("long",1)]
    public async Task RealA5Labels_UsePublishedPersianFonts_AndKeepOnePagePerOrder(string variant,int count)
    {
        var labels=Enumerable.Range(0,count).Select(Label).ToArray();
        if(variant=="long") labels[0]=labels[0] with{StreetAddress=string.Join("، ",Enumerable.Repeat("خیابان نمونه، کوچه آزمایشی، مجتمع وندورا",5))};
        var pdf=await Renderer().RenderAsync(labels,default);Assert.Equal("%PDF",System.Text.Encoding.ASCII.GetString(pdf,0,4));Assert.True(pdf.Length>10000);
        string? output=Environment.GetEnvironmentVariable("VENDORA_LABEL_TEST_OUTPUT");
        if(!string.IsNullOrWhiteSpace(output)){Directory.CreateDirectory(output);await File.WriteAllBytesAsync(Path.Combine(output,$"shipping-label-{variant}-A5.pdf"),pdf);}
    }

    [Fact]
    public async Task OverlongAddressFailsWithOrderNumber_NotTruncatedOrExtraPages_AndLicenseErrorsStayPdfOnly()
    {
        var failed=await Assert.ThrowsAsync<ShippingLabels.LabelException>(()=>Renderer().RenderAsync([Label(0) with{StreetAddress=string.Join(" ",Enumerable.Repeat("نشانی غیرقابل‌جاگیری",2000))}],default));
        Assert.Equal("LABEL_CONTENT_TOO_LONG",failed.Code);Assert.Equal("VD-100",failed.OrderNumber);
        var configuration=new ConfigurationBuilder().Build();
        Assert.Equal("PDF_LICENSE_NOT_CONFIGURED",(await Assert.ThrowsAsync<DocumentRenderUnavailableException>(()=>new QuestShippingLabelRenderer(configuration,new TestEnvironment(),NullLogger<QuestShippingLabelRenderer>.Instance).RenderAsync([Label(0)],default))).Code);
        await Assert.ThrowsAnyAsync<OperationCanceledException>(()=>Renderer().RenderAsync([Label(0)],new CancellationToken(true)));
    }

    /// <summary>Creates a synthetic label for PDF inspection without loading a database, prices or private account records.</summary>
    internal static ShippingLabelData Label(int index)=>new(Guid.NewGuid(),$"VD-{100+index}","گیرنده آزمایشی فارسی","09121234567","تهران","تهران","خیابان نمونه، کوچه آزمایشی","۱۲","۳","1234567890","فروشگاه وندورا","تهران، خیابان فرستنده، پلاک ۴۵","02112345678",index==1?"تیپاکس":"پست پیشتاز",index==1?"پرداخت هنگام تحویل":"رایگان");

    /// <summary>Uses only explicit Community test configuration and published font assets.</summary>
    private static QuestShippingLabelRenderer Renderer()=>new(new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>{["Accounting:Pdf:License"]="Community"}).Build(),new TestEnvironment(),NullLogger<QuestShippingLabelRenderer>.Instance);
    /// <summary>Injects a recording decorator around the real renderer into the existing isolated controller test host.</summary>
    private static Task<ProductArticleTests.ArticleHost> Host(CaptureRenderer capture)=>ProductArticleTests.ArticleHost.CreateAsync(services=>services.AddSingleton<IShippingLabelRenderer>(capture));
    /// <summary>Creates fixed order snapshots and current sender settings in the ephemeral test database only.</summary>
    private static async Task<Guid[]> Seed(ProductArticleTests.ArticleHost host)
    {
        using var scope=host.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var settings=await db.SeoSettings.SingleAsync();settings.SiteName="فرستنده جاری";settings.StoreProfileJson=JsonSerializer.Serialize(new StoreProfile{NameFa="فرستنده جاری",AddressFa="نشانی فرستنده",Phone="02112345678"});
        var orders=Enumerable.Range(0,2).Select(i=>new Order{OrderNumber=$"VD-{100+i}",ShippingRecipientName="گیرنده ثبت‌شده سفارش",ShippingPhoneNumber="09121234567",ShippingProvince="تهران",ShippingCity="تهران",ShippingStreetAddress="نشانی ثبت‌شده در سفارش",ShippingPostalCode="1234567890",TotalAmount=987654321m,ShippingMethodId=i==0?"post":"tipax",ShippingPolicySnapshotJson=JsonSerializer.Serialize(new{IncludedInPrice=i==0})}).ToArray();
        db.Orders.AddRange(orders);await db.SaveChangesAsync();return orders.Select(x=>x.Id).ToArray();
    }
    private sealed class CaptureRenderer:IShippingLabelRenderer
    {
        public int Calls;public IReadOnlyList<ShippingLabelData> Labels=[];
        public Task<byte[]> RenderAsync(IReadOnlyList<ShippingLabelData> labels,CancellationToken ct){Calls++;Labels=labels;return Renderer().RenderAsync(labels,ct);}
    }
    private sealed class TestEnvironment:IHostEnvironment
    {
        public string EnvironmentName{get;set;}="Production";public string ApplicationName{get;set;}="LabelTests";public string ContentRootPath{get;set;}=AppContext.BaseDirectory;public IFileProvider ContentRootFileProvider{get;set;}=new NullFileProvider();
    }
}
