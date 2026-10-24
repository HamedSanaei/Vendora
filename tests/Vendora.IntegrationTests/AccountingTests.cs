using System.Text.Json;
using System.Net;
using System.Net.Http.Json;
using Application.Accounting;
using Domain.Accounting;
using Domain.Entities;
using Domain.Enums;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Persistence;
using Persistence.Identity;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Financial correctness against real SQLite, domain invariants and transaction/idempotency boundaries.</summary>
public sealed class AccountingTests
{
    /// <summary>Repeated identical product lines keep distinct report identities and immutable party/price snapshots.</summary>
    [Fact]
    public async Task ProductHistory_KeepsSeparateLinesAndCommercialSnapshots()
    {
        await using var f = await Fixture.Create();
        var input = f.Input(DocumentKind.Purchase, 1, 100) with
        { Lines = [new(f.Product.Id, 1, 100), new(f.Product.Id, 1, 100)] };
        var id = await new DocumentCommands.SaveDraftHandler(f.Db, f.Work).Handle(new(f.Actor, "history-lines", input), default);
        await f.Post(id);
        var rows = await new AccountingQueries.ProductPricesHandler(f.Db).Handle(new(f.Product.Id), default);
        Assert.Equal(2, rows.Total);
        Assert.Equal(2, rows.Items.Select(x => x.LineId).Distinct().Count());
        Assert.All(rows.Items, row =>
        {
            Assert.Equal(id, row.DocumentId);
            Assert.Equal(DocumentKind.Purchase, row.Kind);
            Assert.Equal(100, row.UnitPrice);
            Assert.Equal(f.Party.Name, JsonSerializer.Deserialize<PartySnapshot>(row.BuyerSnapshotJson)!.Name);
        });
    }

    /// <summary>Moving average changes on receipt only, reserved stock cannot be sold twice, full depletion leaves zero value.</summary>
    [Fact]
    public void WeightedAverage_Reservations_AndDepletion()
    {
        var stock = new InventoryBalance(Guid.NewGuid());
        stock.Receive(10, 1000); stock.Receive(10, 2000);
        Assert.Equal(150, stock.AverageCost);
        stock.Reserve(3);
        Assert.Equal(17, stock.Available);
        Assert.Equal(450, stock.Issue(3, fromReservation: true));
        Assert.Equal(0, stock.Reserved); Assert.Equal(17, stock.OnHand); Assert.Equal(2550, stock.Value);
        Assert.Throws<InvalidOperationException>(() => stock.Issue(18));
        Assert.Equal(2550, stock.Issue(17)); Assert.Equal(0, stock.Value); Assert.Equal(0, stock.AverageCost);
        Assert.Throws<InvalidOperationException>(() => stock.Release(1));
    }

    /// <summary>Drafts never affect stock; finalization is atomic, immutable and deduplicated by payload.</summary>
    [Fact]
    public async Task Posting_IsAtomic_Idempotent_AndImmutable()
    {
        await using var f = await Fixture.Create();
        Guid draft = await f.Draft(DocumentKind.Purchase, 10, 100);
        Assert.Empty(await f.Db.StockMovements.ToListAsync());
        Assert.Equal(0, (await f.Db.Products.SingleAsync()).StockQuantity);
        var before = await f.Db.FinancialDocuments.FindAsync(draft);
        var cmd = new DocumentCommands.Post(f.Actor, "post-first", draft, before!.Version);
        var handler = new DocumentCommands.PostHandler(f.Db, f.Work, f.Posting);
        Assert.Equal(draft, await handler.Handle(cmd, default));
        Assert.Equal(draft, await handler.Handle(cmd, default));
        Assert.Single(await f.Db.StockMovements.ToListAsync());
        Assert.Single(await f.Db.PartyLedgerEntries.ToListAsync());
        Assert.Equal(10, (await f.Db.Products.SingleAsync()).StockQuantity);
        Assert.Equal(1000, (await f.Db.InventoryBalances.SingleAsync()).Value);
        var error = await Assert.ThrowsAsync<AccountingException>(() => handler.Handle(cmd with { Version = 77 }, default));
        Assert.Equal("IDEMPOTENCY_KEY_REUSED", error.Code);
        var doc = await f.Db.FinancialDocuments.Include(x => x.Lines).SingleAsync();
        Assert.Throws<InvalidOperationException>(() => doc.SetDraftContent(doc.Lines, 0, false, "tampered", "{}", "{}"));
        Assert.Throws<InvalidOperationException>(() => doc.SetDraftHeader(DocumentCurrency.Toman, 1, f.Party.Id, DateTime.UtcNow, null, null));
        var evidence = await f.Db.StockMovements.SingleAsync();
        f.Db.StockMovements.Remove(evidence);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Db.SaveChangesAsync());
    }

    /// <summary>USD rate snapshots and net landed costs remain fixed across later product/rate changes.</summary>
    [Fact]
    public async Task Purchases_Freight_Tax_AndUsdSnapshots()
    {
        await using var f = await Fixture.Create();
        Guid first = await f.Draft(DocumentKind.Purchase, 10, 3, currency: DocumentCurrency.Usd, rate: 100,
            discount: 5, tax: 2, freight: 4, recoverable: true);
        var draftBefore = await f.Db.FinancialDocuments.FindAsync(first);
        var edited = f.Input(DocumentKind.Purchase, 10, 3, currency: DocumentCurrency.Usd, rate: 100,
            discount: 5, tax: 2, freight: 4, recoverable: true) with { Id = first, Version = draftBefore!.Version };
        await new DocumentCommands.SaveDraftHandler(f.Db, f.Work).Handle(new(f.Actor, "edit-usd-draft", edited), default);
        Assert.Single(await f.Db.FinancialDocumentLines.ToListAsync());
        Assert.Empty(await f.Db.StockMovements.ToListAsync());
        await f.Post(first);
        Assert.Equal(2900, (await f.Db.InventoryBalances.SingleAsync()).Value);
        Assert.Equal(3100, (await f.Db.FinancialDocuments.FindAsync(first))!.TotalToman);
        await f.Post(await f.Draft(DocumentKind.Purchase, 10, 410));
        Assert.Equal(350, (await f.Db.InventoryBalances.SingleAsync()).AverageCost);
        f.Db.Products.Local.Single().Price = 999999;
        await f.Db.SaveChangesAsync();
        Assert.Equal(100, (await f.Db.FinancialDocuments.FindAsync(first))!.ExchangeRate);
        var sale = await f.Draft(DocumentKind.Sale, 2, 700); await f.Post(sale);
        var row = await f.Db.FinancialDocumentLines.SingleAsync(x => x.DocumentId == sale);
        Assert.Equal(700, row.CostToman);
    }

    /// <summary>Purchase returns value stock at current average, financial credit at original price; sales returns restore captured COGS.</summary>
    [Fact]
    public async Task Returns_UseOriginalLines_AndPreserveValuationDifferences()
    {
        await using var f = await Fixture.Create();
        var first = await f.Draft(DocumentKind.Purchase, 10, 100); await f.Post(first);
        await f.Post(await f.Draft(DocumentKind.Purchase, 10, 200));
        var line = await f.Db.FinancialDocumentLines.SingleAsync(x => x.DocumentId == first);
        var returned = await f.Draft(DocumentKind.PurchaseReturn, 2, 100, original: first, originalLine: line.Id);
        await f.Post(returned);
        var returnLine = await f.Db.FinancialDocumentLines.SingleAsync(x => x.DocumentId == returned);
        Assert.Equal(300, returnLine.CostToman); Assert.Equal(-100, returnLine.ValuationDifferenceToman);
        var sale = await f.Draft(DocumentKind.Sale, 2, 300); await f.Post(sale);
        var sold = await f.Db.FinancialDocumentLines.SingleAsync(x => x.DocumentId == sale);
        var customerReturn = await f.Draft(DocumentKind.SalesReturn, 1, 300, original: sale, originalLine: sold.Id);
        await f.Post(customerReturn);
        Assert.Equal(150, (await f.Db.FinancialDocumentLines.SingleAsync(x => x.DocumentId == customerReturn)).CostToman);
        var excessive = await f.Draft(DocumentKind.SalesReturn, 2, 300, original: sale, originalLine: sold.Id);
        await Assert.ThrowsAsync<AccountingException>(() => f.Post(excessive));
        Assert.Equal(17, (await f.Db.InventoryBalances.SingleAsync()).OnHand);
    }

    /// <summary>A multi-line failure rolls back earlier movements, costs, ledger entries and stock projections.</summary>
    [Fact]
    public async Task FailedPosting_RollsBackAllEffects()
    {
        await using var f = await Fixture.Create();
        await f.Post(await f.Draft(DocumentKind.Purchase, 1, 100));
        var input = f.Input(DocumentKind.Sale, 1, 200) with { Lines = [new(f.Product.Id, 1, 200), new(f.Product.Id, 1, 200)] };
        var id = await new DocumentCommands.SaveDraftHandler(f.Db, f.Work).Handle(new(f.Actor, "two-lines", input), default);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Post(id));
        Assert.Equal(1, (await f.Db.InventoryBalances.SingleAsync()).OnHand);
        Assert.Equal(1, await f.Db.StockMovements.CountAsync());
        Assert.Equal(DocumentStatus.Draft, (await f.Db.FinancialDocuments.FindAsync(id))!.Status);
    }

    /// <summary>Partial receipt/allocations update actual party debt and cannot exceed real money or invoice due.</summary>
    [Fact]
    public async Task PartialSettlements_AndUnallocatedAdvances()
    {
        await using var f = await Fixture.Create();
        await f.Post(await f.Draft(DocumentKind.Purchase, 2, 100));
        Guid sale = await f.Draft(DocumentKind.Sale, 2, 300); await f.Post(sale);
        var receiptInput = new SettlementInput(f.Party.Id, SettlementDirection.Receipt, SettlementMethod.BankTransfer, 400,
            DateTime.UtcNow, "bank-reference");
        var receive = new PartyCommands.ReceiveOrPayHandler(f.Db, f.Work, TimeProvider.System);
        Guid receipt = await receive.Handle(new(f.Actor, "receipt", receiptInput), default);
        var allocate = new PartyCommands.AllocateHandler(f.Db, f.Work, TimeProvider.System);
        var command = new PartyCommands.Allocate(f.Actor, "allocate", receipt, [new(sale, 250)]);
        await allocate.Handle(command, default); await allocate.Handle(command, default);
        Assert.Single(await f.Db.PaymentAllocations.ToListAsync());
        var result = await new AccountingQueries.SettlementsHandler(f.Db).Handle(new(), default);
        Assert.Equal(250, result.Items.Single().AllocatedToman);
        await Assert.ThrowsAsync<AccountingException>(() => allocate.Handle(command with { Key = "too-much", Items = [new(sale, 200)] }, default));
        await Assert.ThrowsAsync<AccountingException>(() => receive.Handle(new(f.Actor, "fake-gateway", receiptInput with { Method = SettlementMethod.VerifiedGateway }), default));
        var ledger = await new AccountingQueries.LedgerHandler(f.Db).Handle(new(f.Party.Id), default);
        Assert.Equal(0, ledger!.BalanceToman); // Purchase payable -200, sale +600, actual receipt -400.
    }

    /// <summary>Customer read contracts enforce ownership and exclude all internal costs/supplier records.</summary>
    [Fact]
    public async Task CustomerIsolation_AndDraftOwnership()
    {
        await using var f = await Fixture.Create();
        var user = new AppUser { FullName = "Buyer", UserName = "buyer" }; f.Db.Users.Add(user);
        f.Party.UserId = user.Id; await f.Db.SaveChangesAsync();
        await f.Post(await f.Draft(DocumentKind.Purchase, 1, 100));
        var sale = await f.Draft(DocumentKind.Sale, 1, 200); await f.Post(sale);
        var handler = new AccountingQueries.MyDocumentHandler(f.Db);
        Assert.Null(await handler.Handle(new(Guid.NewGuid(), sale), default));
        var result = await handler.Handle(new(user.Id, sale), default);
        Assert.NotNull(result);
        string json = JsonSerializer.Serialize(result);
        Assert.DoesNotContain("CostToman", json); Assert.DoesNotContain("CounterpartyId", json);
        Assert.DoesNotContain("ValuationDifference", json);
        var pending = await f.Draft(DocumentKind.Proforma, 1, 200);
        Assert.Null(await handler.Handle(new(user.Id, pending), default));
    }

    /// <summary>Schema migrations are repeatable, additive, and do not activate accounting or mutate legacy stock.</summary>
    [Fact]
    public async Task Migration_DoesNotActivateOrResetStock()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.MigrateAsync(); await db.Database.MigrateAsync();
        Assert.False((await db.AccountingStates.SingleAsync()).Activated);
        Assert.Empty(await db.StockMovements.ToListAsync()); Assert.Empty(await db.FinancialDocuments.ToListAsync());
        var product = new Product { Title = "Legacy", Slug = "legacy", StockQuantity = 8, Price = 100 };
        db.Products.Add(product); await db.SaveChangesAsync();
        Assert.Equal(8, (await db.Products.SingleAsync()).StockQuantity);
    }

    /// <summary>After cutover, direct product stock editing is rejected even outside the accounting handlers.</summary>
    [Fact]
    public async Task ProductStock_IsNotAnEditableAuthority()
    {
        await using var f = await Fixture.Create();
        f.Product.StockQuantity = 100;
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Db.SaveChangesAsync());
    }

    /// <summary>Neither direct balance edits nor appending lines can bypass the posting mechanism/finalized snapshots.</summary>
    [Fact]
    public async Task Persistence_RejectsUnbackedInventory_AndPostedLineAppend()
    {
        await using var f = await Fixture.Create();
        Guid purchase = await f.Draft(DocumentKind.Purchase, 1, 100); await f.Post(purchase);
        var balance = await f.Db.InventoryBalances.SingleAsync(); balance.Receive(1, 100);
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Db.SaveChangesAsync());
        f.Db.ChangeTracker.Clear();
        f.Db.FinancialDocumentLines.Add(new FinancialDocumentLine(purchase, f.Product.Id, f.Product.ProductCode, "Injected line", 1, 1, 0, 0));
        await Assert.ThrowsAsync<InvalidOperationException>(() => f.Db.SaveChangesAsync());
    }

    /// <summary>Initialization requires an unchanged explicit preview, never fabricates an asset and is repeat-safe.</summary>
    [Fact]
    public async Task Setup_RequiresPreviewAndConfirmation_AndPreservesProductCodes()
    {
        await using var f = await Fixture.Create();
        var state = await f.Db.AccountingStates.SingleAsync(); state.Activated = false; await f.Db.SaveChangesAsync();
        f.Product.StockQuantity = 8; await f.Db.SaveChangesAsync();
        var preview = await new AccountingSetup.PreviewHandler(f.Db).Handle(new(), default);
        var handler = new AccountingSetup.ActivateHandler(f.Db, f.Work, new(f.Db, TimeProvider.System), TimeProvider.System);
        var command = new AccountingSetup.Activate(f.Actor, "setup", [f.Product.Id], preview.Fingerprint, "ZERO_SELECTED_DEMO_STOCK");
        await Assert.ThrowsAsync<AccountingException>(() => handler.Handle(command with { Confirmation = "", Key = "unconfirmed" }, default));
        Guid operation = await handler.Handle(command, default);
        Assert.Equal(operation, await handler.Handle(command, default));
        Assert.Equal(0, (await f.Db.Products.SingleAsync()).StockQuantity);
        Assert.Equal(f.Product.ProductCode, (await f.Db.Products.SingleAsync()).ProductCode);
        Assert.Equal(0, (await f.Db.InventoryBalances.SingleAsync()).Value);
        Assert.Equal(2, await f.Db.StockMovements.CountAsync());
        Assert.Equal(0, (await f.Db.StockMovements.Select(x => x.QuantityDelta).ToListAsync()).Sum());
        Assert.Empty(await f.Db.PartyLedgerEntries.ToListAsync()); Assert.Empty(await f.Db.FinancialDocuments.ToListAsync());
    }

    /// <summary>Setup refuses open orders, stale previews and omitted positive legacy quantities.</summary>
    [Fact]
    public async Task Setup_BlocksOpenCommerceAndUnselectedStock()
    {
        await using var f = await Fixture.Create();
        var state = await f.Db.AccountingStates.SingleAsync(); state.Activated = false; await f.Db.SaveChangesAsync();
        f.Product.StockQuantity = 5; await f.Db.SaveChangesAsync();
        var previews = new AccountingSetup.PreviewHandler(f.Db);
        var before = await previews.Handle(new(), default);
        var open = new Order { OrderNumber = "setup-open-order" }; f.Db.Orders.Add(open); await f.Db.SaveChangesAsync();
        var current = await previews.Handle(new(), default);
        var handler = new AccountingSetup.ActivateHandler(f.Db, f.Work, new(f.Db, TimeProvider.System), TimeProvider.System);
        var command = new AccountingSetup.Activate(f.Actor, "blocked", [f.Product.Id], current.Fingerprint, "ZERO_SELECTED_DEMO_STOCK");
        Assert.Equal("SETUP_PREVIEW_CHANGED", (await Assert.ThrowsAsync<AccountingException>(() => handler.Handle(command with { PreviewFingerprint = before.Fingerprint }, default))).Code);
        Assert.Equal("OPEN_COMMERCE_BLOCKS_SETUP", (await Assert.ThrowsAsync<AccountingException>(() => handler.Handle(command, default))).Code);
        open = await f.Db.Orders.SingleAsync(); open.Status = OrderStatus.Cancelled; await f.Db.SaveChangesAsync();
        current = await previews.Handle(new(), default);
        Assert.Equal("UNRESOLVED_POSITIVE_LEGACY_STOCK", (await Assert.ThrowsAsync<AccountingException>(() => handler.Handle(command with { ProductIds = [], PreviewFingerprint = current.Fingerprint }, default))).Code);
        Assert.Equal(5, (await f.Db.Products.SingleAsync()).StockQuantity);
    }

    /// <summary>Real HTTP policy rejects guests/customers from admin financial APIs and requires ownership subjects.</summary>
    [Fact]
    public async Task HttpAuthorization_ProtectsAdminAndCustomerDocuments()
    {
        await using var host = await ProductArticleTests.ArticleHost.CreateAsync();
        using var guest = host.Client(null); using var customer = host.Client("Customer"); using var admin = host.Client("Admin");
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/admin/accounting/overview")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await customer.GetAsync("/api/admin/accounting/overview")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/account/documents")).StatusCode);
        var result = await admin.GetFromJsonAsync<AccountingOverviewDto>("/api/admin/accounting/overview");
        Assert.False(result!.Activated);
        customer.DefaultRequestHeaders.Add("Test-User", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.NotFound, (await customer.GetAsync($"/api/account/documents/{Guid.NewGuid()}")).StatusCode);
    }

    /// <summary>Quote issuance preserves snapshots, prices only on the server, and does not reserve/consume goods.</summary>
    [Fact]
    public async Task Proformas_AreImmutable_Idempotent_AndServerPriced()
    {
        await using var f = await Fixture.Create();
        await f.Post(await f.Draft(DocumentKind.Purchase, 3, 100));
        var user = new AppUser { FirstName = "Quote", LastName = "Buyer", Email = "quote@example.invalid", PhoneNumber = "09121111111", PhoneNumberConfirmed = true, FullName = "Quote buyer", UserName = "quote-buyer" }; f.Db.Users.Add(user); await f.Db.SaveChangesAsync();
        var handler = new ProformaCommands.IssueHandler(f.Db, f.Work, new CartQuotation(f.Db, TimeProvider.System), TimeProvider.System);
        var command = new ProformaCommands.Issue(user.Id, "quote-1", [new(f.Product.Id, 2, 300)], null, null);
        var id = await handler.Handle(command, default); Assert.Equal(id, await handler.Handle(command, default));
        var doc = await new AccountingQueries.MyDocumentHandler(f.Db).Handle(new(user.Id, id), default);
        Assert.Equal(600, doc!.TotalToman); Assert.True(doc.ShippingUndetermined);
        Assert.Equal(0, (await f.Db.InventoryBalances.SingleAsync()).Reserved);
        Assert.Equal(3, (await f.Db.InventoryBalances.SingleAsync()).OnHand);
        Assert.Single(await f.Db.StockMovements.ToListAsync()); // Only the earlier purchase.
        f.Db.Products.Local.Single().Price = 999; await f.Db.SaveChangesAsync();
        Assert.Equal(600, (await new AccountingQueries.MyDocumentHandler(f.Db).Handle(new(user.Id, id), default))!.TotalToman);
        await Assert.ThrowsAsync<Application.Pricing.PriceChangedException>(() => handler.Handle(command with { Key = "new-quote" }, default));
        await Assert.ThrowsAsync<AccountingException>(() => handler.Handle(command with { Key = "fake-discount", Items = [new(f.Product.Id, 1)], CouponCode = "fake" }, default));
    }

    /// <summary>The actual checkout handler reserves instead of deducting after cutover and ignores browser shipping totals.</summary>
    [Fact]
    public async Task Checkout_UsesServerPricing_AndIdempotentReservations()
    {
        await using var f = await Fixture.Create();
        await f.Post(await f.Draft(DocumentKind.Purchase, 1, 100));
        var user = new AppUser { FirstName = "Checkout", LastName = "Buyer", Email = "checkout@example.invalid", PhoneNumber = "09121111111", PhoneNumberConfirmed = true, FullName = "Checkout buyer", UserName = "checkout-buyer" }; f.Db.Users.Add(user); await f.Db.SaveChangesAsync();
        var handler = new Application.Orders.Create.Handler(new Persistence.Carts.CartRepository(f.Db),
            new Persistence.Orders.OrderRepository(f.Db), new Persistence.Products.ProductReadRepository(f.Db), f.Db, f.Db);
        var address = new Application.Orders.Create.AddressInput("Home", "Buyer", "09123456789", "Province", "City", "Street", null, null,
            "1234567890", true, true);
        var command = new Application.Orders.Create.Command(user.Id, 1, 0, null, address, [new(f.Product.Id, 1, 300)], "post", null, "checkout-1");
        var order = await handler.Handle(command, default);
        var repeated = await handler.Handle(command, default);
        Assert.Equal(order.OrderNumber, repeated.OrderNumber);
        Assert.Equal(60000, order.ShippingCost); Assert.Equal(60300, order.TotalAmount);
        Assert.Equal(1, await f.Db.Orders.CountAsync()); Assert.Equal(1, await f.Db.StockReservations.CountAsync());
        var balance = await f.Db.InventoryBalances.SingleAsync();
        Assert.Equal(1, balance.OnHand); Assert.Equal(1, balance.Reserved); Assert.Equal(0, balance.Available);
        var manipulated = command with { IdempotencyKey = "checkout-forged-discount", DiscountAmount = 100000 };
        Assert.Equal("COUPON_CODE_REQUIRED", (await Assert.ThrowsAsync<AccountingException>(() => handler.Handle(manipulated, default))).Code);
        Assert.Equal(1, await f.Db.Orders.CountAsync());
    }

    /// <summary>A real active coupon is recomputed/capped on the server rather than accepting a requested discount amount.</summary>
    [Fact]
    public async Task CartPricing_ValidatesCouponAndShipping()
    {
        await using var f = await Fixture.Create();
        await f.Post(await f.Draft(DocumentKind.Purchase, 2, 100));
        f.Db.Coupons.Add(new Coupon { Title = "Discount", Code = "REAL", DiscountPercent = 50, MaxDiscountAmount = 100,
            ExpiresAtUtc = DateTime.UtcNow.AddDays(1), AppliesToAllCategories = true });
        await f.Db.SaveChangesAsync();
        var pricing = new CartQuotation(f.Db, TimeProvider.System);
        var quote = await pricing.QuoteAsync([new(f.Product.Id, 2)], "tipax", "real", default);
        Assert.Equal(100, quote.Discount); Assert.Equal(500, quote.Net); Assert.Equal(20000, quote.Freight);
        var collect = await pricing.QuoteAsync([new(f.Product.Id, 1)], "freight", null, default);
        Assert.Equal(0, collect.Freight); Assert.False(collect.ShippingUndetermined);
        await Assert.ThrowsAsync<AccountingException>(() => pricing.QuoteAsync([new(f.Product.Id, 1)], "fake-free-post", null, default));
    }

    /// <summary>Real verified evidence consumes an existing reservation and issues exactly one invoice and receipt.</summary>
    [Fact]
    public async Task VerifiedPayment_ConsumesReservation_WithoutDoubleDeduction()
    {
        await using var f = await Fixture.Create();
        await f.Post(await f.Draft(DocumentKind.Purchase, 1, 100));
        var payment = await f.OrderPayment(reserve: true);
        Assert.Equal(1, (await f.Db.InventoryBalances.SingleAsync()).Reserved);
        Assert.Equal(1, (await f.Db.InventoryBalances.SingleAsync()).OnHand);
        Assert.Equal(0, (await f.Db.Products.SingleAsync()).StockQuantity);
        var handler = f.Finalizer;
        var command = new CommercePosting.FinalizeVerifiedPayment(payment.Id);
        Guid receipt = await handler.Handle(command, default);
        Assert.Equal(receipt, await handler.Handle(command, default));
        Assert.Single(await f.Db.Settlements.ToListAsync());
        Assert.Single(await f.Db.FinancialDocuments.Where(x => x.Kind == DocumentKind.Sale).ToListAsync());
        var balance = await f.Db.InventoryBalances.SingleAsync();
        Assert.Equal(0, balance.OnHand); Assert.Equal(0, balance.Reserved); Assert.Equal(0, balance.Value);
        Assert.Equal(ReservationStatus.Consumed, (await f.Db.StockReservations.SingleAsync()).Status);
        Assert.Equal(OrderStatus.Paid, payment.Order.Status);
        Assert.Equal(1, await f.Db.StockMovements.CountAsync(x => x.Kind == StockMovementKind.Sale));
        var status = await new Application.Admin.Orders.ChangeStatus.Handler(f.Db)
            .Handle(new(payment.OrderId, OrderStatus.Cancelled, f.Actor), default);
        Assert.True(status.Succeeded);
        Assert.Equal(1, (await f.Db.InventoryBalances.SingleAsync()).OnHand);
        Assert.Equal(PaymentStatus.Verified, payment.Order.PaymentStatus); // No fabricated refund.
    }

    /// <summary>Missing verification provenance cannot create money; late insufficient payments create an unallocated review receipt.</summary>
    [Fact]
    public async Task LatePayment_AndUnprovenVerification_AreHandledSafely()
    {
        await using var f = await Fixture.Create();
        var payment = await f.OrderPayment(reserve: false, proven: false);
        await Assert.ThrowsAsync<AccountingException>(() => f.Finalizer.Handle(new(payment.Id), default));
        Assert.Empty(await f.Db.Settlements.ToListAsync());
        var persisted = await f.Db.PaymentTransactions.Include(x => x.Order).ThenInclude(x => x.Items).SingleAsync();
        persisted.RecordServerVerification("fixture-verified-reference", DateTime.UtcNow, new string('A', 64));
        await f.Db.SaveChangesAsync();
        await f.Finalizer.Handle(new(persisted.Id), default);
        var receipt = await f.Db.Settlements.SingleAsync(); Assert.True(receipt.RequiresReview);
        Assert.Empty(await f.Db.PaymentAllocations.ToListAsync());
        Assert.Empty(await f.Db.FinancialDocuments.Where(x => x.Kind == DocumentKind.Sale).ToListAsync());
        Assert.Equal(0, (await f.Db.InventoryBalances.SingleAsync()).OnHand);
    }

    /// <summary>Expiry followed by cancellation and duplicate expiry never releases the same quantity twice.</summary>
    [Fact]
    public async Task ReservationExpiry_ThenCancellation_IsExactlyOnce()
    {
        await using var f = await Fixture.Create();
        await f.Post(await f.Draft(DocumentKind.Purchase, 1, 100));
        var payment = await f.OrderPayment(reserve: true, proven: false);
        var hold = await f.Db.StockReservations.SingleAsync();
        var future = new FixedClock(DateTimeOffset.UtcNow.AddMinutes(31));
        var expire = new InventoryCommands.ExpireHandler(f.Db, new AccountingUnitOfWork(f.Db, future), new InventoryPosting(f.Db, future), future);
        await expire.Handle(new(hold.Id), default); await expire.Handle(new(hold.Id), default);
        await using (var tx = await f.Db.Database.BeginTransactionAsync())
        {
            await f.Work.AcquireGateAsync(default);
            await new OrderReservations(f.Db, new InventoryPosting(f.Db, TimeProvider.System), TimeProvider.System).ReleaseAsync(payment.OrderId, f.Actor, default);
            await f.Db.SaveChangesAsync(); await tx.CommitAsync();
        }
        Assert.Equal(1, (await f.Db.InventoryBalances.SingleAsync()).Available);
        Assert.Equal(0, (await f.Db.InventoryBalances.SingleAsync()).Reserved);
        Assert.Equal(1, await f.Db.StockMovements.CountAsync(x => x.Kind == StockMovementKind.Release));
        // The same genuine late payment can now recheck available stock and fulfil without an active reservation.
        payment.RecordServerVerification("fixture-late-reference", DateTime.UtcNow, new string('B', 64)); await f.Db.SaveChangesAsync();
        await f.Finalizer.Handle(new(payment.Id), default);
        Assert.Equal(0, (await f.Db.InventoryBalances.SingleAsync()).OnHand);
    }

    /// <summary>Historical verified imports are retry-safe, leave inventory untouched and keep COGS explicitly unknown.</summary>
    [Fact]
    public async Task HistoricalReconciliation_DoesNotDeductStockOrInventCosts()
    {
        await using var f = await Fixture.Create();
        var payment = await f.OrderPayment(reserve: false);
        var state = await f.Db.AccountingStates.SingleAsync(); state.ActivatedAtUtc = DateTime.UtcNow.AddSeconds(1); await f.Db.SaveChangesAsync();
        var command = new CommercePosting.FinalizeVerifiedPayment(payment.Id, f.Actor,
            CommercePosting.PreviewFingerprint(payment), "RECONCILE_VERIFIED_PAYMENT");
        await f.Finalizer.Handle(command, default); await f.Finalizer.Handle(command, default);
        Assert.Empty(await f.Db.StockMovements.ToListAsync());
        Assert.Null((await f.Db.FinancialDocumentLines.SingleAsync()).CostToman);
        Assert.Single(await f.Db.Settlements.ToListAsync());
        var overview = await new AccountingQueries.OverviewHandler(f.Db).Handle(new(), default);
        Assert.Equal(1, overview.UnknownCostLines); Assert.Equal(0, overview.GrossProfitKnownToman);
    }

    /// <summary>Separate processes/contexts cannot post two sales of the same last available unit.</summary>
    [Fact]
    public async Task ConcurrentLastUnitSale_OnlyOneCanPost()
    {
        string path = Path.Combine(Path.GetTempPath(), $"vendora-accounting-{Guid.NewGuid():N}.db");
        var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlite($"Data Source={path};Pooling=False;Default Timeout=30").Options;
        Guid productId, partyId, actor = Guid.NewGuid();
        try
        {
            await using (var db = new AppDbContext(options))
            {
                await db.Database.MigrateAsync();
                var p = new Product { Title = "Last unit", Slug = "last-unit", Price = 300 }; var party = new Counterparty { Name = "Party" };
                db.AddRange(p, party); await db.SaveChangesAsync(); productId = p.Id; partyId = party.Id;
                var state = await db.AccountingStates.SingleAsync(); state.Activated = true; await db.SaveChangesAsync();
                var work = new AccountingUnitOfWork(db, TimeProvider.System);
                var input = new DraftInput(null, 0, DocumentKind.Purchase, partyId, DocumentCurrency.Toman, 1, DateTime.UtcNow, [new(productId, 1, 100)]);
                var purchase = await new DocumentCommands.SaveDraftHandler(db, work).Handle(new(actor, "purchase", input), default);
                var doc = await db.FinancialDocuments.FindAsync(purchase);
                await new DocumentCommands.PostHandler(db, work, new(db, new(db, TimeProvider.System), TimeProvider.System))
                    .Handle(new(actor, "purchase-post", purchase, doc!.Version), default);
            }
            var results = await Task.WhenAll(Enumerable.Range(0, 2).Select(i => Task.Run(async () =>
            {
                await using var db = new AppDbContext(options); var work = new AccountingUnitOfWork(db, TimeProvider.System);
                var input = new DraftInput(null, 0, DocumentKind.Sale, partyId, DocumentCurrency.Toman, 1, DateTime.UtcNow, [new(productId, 1, 300)]);
                Guid sale = await new DocumentCommands.SaveDraftHandler(db, work).Handle(new(actor, $"sale-{i}", input), default);
                var doc = await db.FinancialDocuments.FindAsync(sale);
                try
                {
                    await new DocumentCommands.PostHandler(db, work, new(db, new(db, TimeProvider.System), TimeProvider.System))
                        .Handle(new(actor, $"sale-post-{i}", sale, doc!.Version), default); return true;
                }
                catch (InvalidOperationException) { return false; }
            })));
            Assert.Equal(1, results.Count(x => x));
            await using var verify = new AppDbContext(options);
            Assert.Equal(0, (await verify.InventoryBalances.SingleAsync()).OnHand);
            Assert.Equal(1, await verify.StockMovements.CountAsync(x => x.Kind == StockMovementKind.Sale));
        }
        finally
        {
            // This fixture owns only these uniquely named temporary database files.
            foreach (string suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix);
        }
    }

    /// <summary>A second genuine payment is preserved as unallocated money, not a second stock deduction/invoice.</summary>
    [Fact]
    public async Task SecondVerifiedPayment_PreservesReceiptWithoutRepeatingSale()
    {
        await using var f = await Fixture.Create();
        var purchase = await f.Draft(DocumentKind.Purchase, 2, 100); await f.Post(purchase);
        var first = await f.OrderPayment(true); await f.Finalizer.Handle(new(first.Id), default);
        var second = new PaymentTransaction { OrderId = first.OrderId, Provider = PaymentProvider.Zarinpal, Authority = "second-real-payment-fixture", Amount = first.Amount };
        second.RecordServerVerification("second-verified-reference-fixture", DateTime.UtcNow, new string('D', 64));
        f.Db.PaymentTransactions.Add(second); await f.Db.SaveChangesAsync();
        await f.Finalizer.Handle(new(second.Id), default);
        await f.Finalizer.Handle(new(second.Id), default);
        Assert.Equal(2, await f.Db.Settlements.CountAsync());
        Assert.Equal(1, await f.Db.FinancialDocuments.CountAsync(x => x.Kind == DocumentKind.Sale));
        Assert.Equal(1, (await f.Db.InventoryBalances.SingleAsync()).OnHand);
        var review = await f.Db.Settlements.SingleAsync(x => x.PaymentTransactionId == second.Id);
        Assert.True(review.RequiresReview);
        Assert.False(await f.Db.PaymentAllocations.AnyAsync(x => x.SettlementId == review.Id));
    }

    /// <summary>PDF ownership/type/state is enforced before the renderer sees any snapshot.</summary>
    [Fact]
    public async Task PdfQuery_ChecksOwnershipAndCommercialTypeBeforeRendering()
    {
        await using var f = await Fixture.Create();
        var owner = new AppUser { UserName = Guid.NewGuid().ToString(), FullName = "PDF owner" };
        f.Db.Users.Add(owner); f.Party.UserId = owner.Id; await f.Db.SaveChangesAsync();
        var quote = await f.Draft(DocumentKind.Proforma, 1, 300); await f.Post(quote);
        var renderer = new CapturingRenderer();
        var handler = new DocumentPdf.Handler(f.Db, renderer);
        Assert.Null(await handler.Handle(new(quote, Guid.NewGuid(), false, Application.Interfaces.DocumentPaperSize.A4), default));
        Assert.Null(renderer.Document);
        var result = await handler.Handle(new(quote, owner.Id, false, Application.Interfaces.DocumentPaperSize.A5), default);
        Assert.NotNull(result); Assert.NotNull(renderer.Document);
        Assert.Equal("Proforma", renderer.Document.Kind);
        Assert.DoesNotContain("cost", JsonSerializer.Serialize(renderer.Document), StringComparison.OrdinalIgnoreCase);
        var purchase = await f.Draft(DocumentKind.Purchase, 1, 100); await f.Post(purchase);
        Assert.Null(await handler.Handle(new(purchase, f.Actor, true, Application.Interfaces.DocumentPaperSize.A4), default));
        var draft = await f.Draft(DocumentKind.Proforma, 1, 100);
        Assert.Null(await handler.Handle(new(draft, owner.Id, false, Application.Interfaces.DocumentPaperSize.A4), default));
    }

    /// <summary>Return source context uses posted evidence; a draft return does not consume returnable quantity.</summary>
    [Fact]
    public async Task ReturnContext_AndServerDecimalReturnPricing_AreAuthoritative()
    {
        await using var f = await Fixture.Create();
        var purchase = await f.Draft(DocumentKind.Purchase, 3, 100); await f.Post(purchase);
        var sale = await f.Draft(DocumentKind.Sale, 3, 300, discount: 10); await f.Post(sale);
        var source = await f.Db.FinancialDocuments.Include(x => x.Lines).SingleAsync(x => x.Id == sale);
        var line = source.Lines.Single();
        var input = f.Input(DocumentKind.SalesReturn, 1, 999, sale, line.Id) with { Lines = [new(f.Product.Id, 1, 999, 3.333333333333333m, 99, line.Id)] };
        var returned = await new DocumentCommands.SaveDraftHandler(f.Db, f.Work).Handle(new(f.Actor, "decimal-return", input), default);
        var context = new AccountingQueries.DocumentContextHandler(f.Db);
        Assert.Equal(3, (await context.Handle(new(sale), default))!.ReturnableLines.Single().RemainingQuantity);
        await f.Post(returned);
        var actual = (await f.Db.FinancialDocuments.Include(x => x.Lines).SingleAsync(x => x.Id == returned)).Lines.Single();
        Assert.Equal(300, actual.UnitPrice); Assert.Equal(10m / 3m, actual.Discount); Assert.Equal(0, actual.Tax);
        var after = (await context.Handle(new(sale), default))!;
        Assert.Equal(2, after.ReturnableLines.Single().RemainingQuantity);
        Assert.Equal(1, after.ReturnableLines.Single().ReturnedQuantity);
    }

    /// <summary>Zero-stock products remain reachable for authorized adjustments without creating fictitious stock/assets.</summary>
    [Fact]
    public async Task InventoryRead_IncludesUninitializedProduct_AndFiltersByIdentity()
    {
        await using var f = await Fixture.Create();
        var rows = await new AccountingQueries.InventoryHandler(f.Db).Handle(new(1, f.Product.Id), default);
        var row = Assert.Single(rows.Items);
        Assert.Equal(0, row.OnHand); Assert.Equal(0, row.ValueToman); Assert.Equal(0, row.Version);
        Assert.Equal(0, await f.Db.InventoryBalances.CountAsync());
        Assert.Empty((await new AccountingQueries.InventoryHandler(f.Db).Handle(new(1, Guid.NewGuid()), default)).Items);
    }

    /// <summary>Summary cards and profit reports agree with actual invoices, advances, allocations and stock snapshots.</summary>
    [Fact]
    public async Task Summaries_UseActualBalancesAndExcludeTaxFreightFromGoodsProfit()
    {
        await using var f = await Fixture.Create();
        var purchase = await f.Draft(DocumentKind.Purchase, 3, 100); await f.Post(purchase);
        var sale = await f.Draft(DocumentKind.Sale, 2, 300); await f.Post(sale);
        var money = await new PartyCommands.ReceiveOrPayHandler(f.Db, f.Work, TimeProvider.System)
            .Handle(new(f.Actor, "summary-receipt", new(f.Party.Id, SettlementDirection.Receipt, SettlementMethod.BankTransfer, 100, DateTime.UtcNow, "fixture-transfer")), default);
        await new PartyCommands.AllocateHandler(f.Db, f.Work, TimeProvider.System).Handle(new(f.Actor, "summary-allocation", money, [new(sale, 60)]), default);
        var docs = await new AccountingSummaries.DocumentsHandler(f.Db).Handle(new(DocumentKind.Sale), default);
        Assert.Equal(1, docs.PostedCount); Assert.Equal(600, docs.PostedTotalToman); Assert.Equal(540, docs.OutstandingToman);
        var parties = await new AccountingSummaries.PartiesHandler(f.Db).Handle(new(), default);
        Assert.Equal(1, parties.Total); Assert.Equal(1, parties.Debtors);
        var funds = await new AccountingSummaries.SettlementsHandler(f.Db).Handle(new(), default);
        Assert.Equal(100, funds.ReceiptsToman); Assert.Equal(40, funds.UnallocatedReceiptsToman);
        var inventory = await new AccountingSummaries.InventoryHandler(f.Db).Handle(new(), default);
        Assert.Equal(1, inventory.Available); Assert.Equal(100, inventory.ValueToman);
        var report = Assert.Single((await new AccountingReports.ProductProfitHandler(f.Db).Handle(new(), default)).Items);
        Assert.Equal(600, report.NetSalesToman); Assert.Equal(200, report.KnownCostToman); Assert.Equal(400, report.KnownProfitToman);
        var party = Assert.Single((await new AccountingQueries.PartiesHandler(f.Db).Handle(new(), default)).Items);
        Assert.Equal(200, party.BalanceToman);
    }

    private sealed class CapturingRenderer : Application.Interfaces.ICommercialDocumentRenderer
    {
        public CustomerDocumentDto? Document { get; private set; }
        /// <summary>Captures only authorized public DTOs; actual PDF typography is covered by CommercialPdfTests.</summary>
        public Task<byte[]> RenderAsync(CustomerDocumentDto document, Application.Interfaces.DocumentPaperSize size, CancellationToken cancellationToken)
        { Document = document; return Task.FromResult(new byte[] { 1 }); }
    }

    /// <summary>Deterministic clock for expiry tests without sleeping.</summary>
    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    /// <summary>Creates an isolated migrated database and explicitly enables only this test's empty inventory.</summary>
    private sealed class Fixture : IAsyncDisposable
    {
        public required SqliteConnection Connection { get; init; }
        public required AppDbContext Db { get; init; }
        public Guid Actor { get; } = Guid.NewGuid();
        public required Product Product { get; init; }
        public required Counterparty Party { get; init; }
        public AccountingUnitOfWork Work => new(Db, TimeProvider.System);
        public DocumentPosting Posting => new(Db, new InventoryPosting(Db, TimeProvider.System), TimeProvider.System);
        public CommercePosting.FinalizeHandler Finalizer => new(Db, Work, new(Db, TimeProvider.System),
            new(Db, new(Db, TimeProvider.System), TimeProvider.System), Posting, TimeProvider.System);

        /// <summary>Creates isolated verification fixtures; it never invokes or simulates a production gateway endpoint.</summary>
        public async Task<PaymentTransaction> OrderPayment(bool reserve, bool proven = true)
        {
            var user = new AppUser { FullName = "Order buyer", UserName = Guid.NewGuid().ToString() }; Db.Users.Add(user); await Db.SaveChangesAsync();
            var order = new Order { UserId = user.Id, OrderNumber = Guid.NewGuid().ToString(), ShippingRecipientName = "Order buyer",
                Items = [new OrderItem { ProductId = Product.Id, ProductTitle = Product.Title, UnitPrice = 300, Quantity = 1 }] };
            order.RecalculateTotals();
            var payment = new PaymentTransaction { Order = order, Provider = PaymentProvider.Zarinpal, Authority = "fixture-authority", Amount = order.TotalAmount };
            if (proven) payment.RecordServerVerification("fixture-verified-reference", DateTime.UtcNow, new string('C', 64));
            else payment.Status = PaymentStatus.Verified;
            await using var tx = await Db.Database.BeginTransactionAsync(); await Work.AcquireGateAsync(default);
            Db.AddRange(order, payment);
            if (reserve) await new OrderReservations(Db, new(Db, TimeProvider.System), TimeProvider.System).ReserveAsync(order, order.Items.Single(), Actor, default);
            await Db.SaveChangesAsync(); await tx.CommitAsync(); return payment;
        }

        /// <summary>Creates only zero-stock test fixtures; no production database is opened.</summary>
        public static async Task<Fixture> Create()
        {
            var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
            var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
            await db.Database.MigrateAsync();
            var product = new Product { Title = "Test bag", Slug = "test-bag", Price = 300, Status = ProductStatus.Active };
            var party = new Counterparty { Name = "Test party", Role = CounterpartyRole.Both };
            db.AddRange(product, party); await db.SaveChangesAsync();
            var state = await db.AccountingStates.SingleAsync(); state.Activated = true; await db.SaveChangesAsync();
            return new Fixture { Connection = connection, Db = db, Product = product, Party = party };
        }
        /// <summary>Builds a correctly typed draft command input for the current fixture.</summary>
        public DraftInput Input(DocumentKind kind, int quantity, decimal price, Guid? original = null, Guid? originalLine = null,
            DocumentCurrency currency = DocumentCurrency.Toman, decimal rate = 1, decimal discount = 0, decimal tax = 0, decimal freight = 0, bool recoverable = false)
            => new(null, 0, kind, Party.Id, currency, rate, DateTime.UtcNow, [new(Product.Id, quantity, price, discount, tax, originalLine)], freight, recoverable, "", original);
        /// <summary>Saves a test draft through its actual handler/UoW.</summary>
        public Task<Guid> Draft(DocumentKind kind, int quantity, decimal price, Guid? original = null, Guid? originalLine = null,
            DocumentCurrency currency = DocumentCurrency.Toman, decimal rate = 1, decimal discount = 0, decimal tax = 0, decimal freight = 0, bool recoverable = false)
            => new DocumentCommands.SaveDraftHandler(Db, Work).Handle(new(Actor, Guid.NewGuid().ToString(), Input(kind, quantity, price,
                original, originalLine, currency, rate, discount, tax, freight, recoverable)), default);
        /// <summary>Posts with the persisted optimistic version and a fresh operation key.</summary>
        public async Task Post(Guid id)
        {
            var doc = await Db.FinancialDocuments.FindAsync(id);
            await new DocumentCommands.PostHandler(Db, Work, Posting).Handle(new(Actor, Guid.NewGuid().ToString(), id, doc!.Version), default);
        }
        /// <summary>Disposes the isolated in-memory database after each test.</summary>
        public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await Connection.DisposeAsync(); }
    }
}
