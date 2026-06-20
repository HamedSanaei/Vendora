using Domain.Entities;
using Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Persistence;

/// <summary>
/// Seeds safe development data when the database is empty.
/// </summary>
public static class SeedData
{
    /// <summary>
    /// Inserts sample data only when the main catalog is empty.
    /// </summary>
    /// <param name="dbContext">The application database context.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    public static async Task SeedAsync(AppDbContext dbContext, CancellationToken cancellationToken = default)
    {
        if (await dbContext.Products.AsNoTracking().AnyAsync(cancellationToken))
        {
            await SeedAdminTablesAsync(dbContext, cancellationToken);
            return;
        }

        var handbags = new Category
        {
            Name = "Handbags",
            Slug = "handbags",
            IsActive = false
        };

        var backpacks = new Category
        {
            Name = "Backpacks",
            Slug = "backpacks",
            IsActive = false
        };

        var travelBags = new Category
        {
            Name = "Travel Bags",
            Slug = "travel-bags",
            IsActive = false
        };

        var workBags = new Category
        {
            Name = "Work Bags",
            Slug = "work-bags",
            IsActive = false
        };

        var waterproofHuntingBags = new Category
        {
            Name = "Waterproof Hunting Bags",
            Slug = "waterproof-hunting-bags",
            IsActive = false,
            ParentCategory = backpacks
        };

        var pistolHuntingBags = new Category
        {
            Name = "Pistol Hunting Bags",
            Slug = "pistol-hunting-bags",
            IsActive = false,
            ParentCategory = backpacks
        };

        var vendoraStudio = new Brand
        {
            Name = "Vendora Studio",
            Slug = "vendora-studio",
            LogoUrl = "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=300&q=80",
            Email = "brand@vendora.local",
            Website = "https://vendora.local",
            Description = "Internal bag manufacturing brand.",
            Location = "Tehran",
            IsActive = true
        };

        var urbanCarry = new Brand
        {
            Name = "Urban Carry",
            Slug = "urban-carry",
            LogoUrl = "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=300&q=80",
            Description = "Everyday bags for city life.",
            Location = "Karaj",
            IsActive = true
        };

        var black = new CatalogColor { Name = "Black", Slug = "black", HexCode = "#111827", IsActive = true };
        var brown = new CatalogColor { Name = "Brown", Slug = "brown", HexCode = "#92400e", IsActive = true };
        var green = new CatalogColor { Name = "Green", Slug = "green", HexCode = "#047857", IsActive = true };
        var navy = new CatalogColor { Name = "Navy", Slug = "navy", HexCode = "#1e3a8a", IsActive = true };
        var taxonomy = CreateBagTaxonomy();

        var leatherHandbag = new Product
        {
            Title = "Leather Handbag",
            Slug = "leather-handbag",
            Description = "A compact leather handbag for everyday use.",
            Price = 1250000m,
            StockQuantity = 18,
            Status = ProductStatus.Active,
            InventoryStatus = InventoryStatus.InStock,
            Category = handbags,
            Categories = CreateProductCategoryLinks(taxonomy, "women-handbag", "natural-leather-bag", "daily-bag", "women-bag", "best-sellers", "gift-worthy"),
            Brand = vendoraStudio,
            Colors = [new ProductColor { CatalogColor = brown }, new ProductColor { CatalogColor = black }],
            Images =
            [
                new ProductImage
                {
                    ImageUrl = "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80",
                    AltText = "Leather handbag",
                    IsPrimary = true,
                    SortOrder = 1
                }
            ]
        };

        var cityBackpack = new Product
        {
            Title = "City Backpack",
            Slug = "city-backpack",
            Description = "A lightweight backpack designed for daily commuting.",
            Price = 980000m,
            StockQuantity = 11,
            Status = ProductStatus.Active,
            InventoryStatus = InventoryStatus.InStock,
            Category = backpacks,
            Categories = CreateProductCategoryLinks(taxonomy, "backpack", "fabric-bag", "student-bag", "unisex-bag", "economic-bags", "new-models"),
            Brand = urbanCarry,
            Colors = [new ProductColor { CatalogColor = black }, new ProductColor { CatalogColor = navy }],
            Images =
            [
                new ProductImage
                {
                    ImageUrl = "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
                    AltText = "City backpack",
                    IsPrimary = true,
                    SortOrder = 1
                }
            ]
        };

        var weekenderBag = new Product
        {
            Title = "Weekender Duffel",
            Slug = "weekender-duffel",
            Description = "A spacious duffel bag for short trips and weekend travel.",
            Price = 1560000m,
            StockQuantity = 7,
            Status = ProductStatus.Active,
            InventoryStatus = InventoryStatus.LowStock,
            Category = travelBags,
            Categories = CreateProductCategoryLinks(taxonomy, "travel-bag", "canvas-bag", "travel-use-bag", "unisex-bag", "summer-collection"),
            Brand = vendoraStudio,
            Colors = [new ProductColor { CatalogColor = green }, new ProductColor { CatalogColor = black }],
            Images =
            [
                new ProductImage
                {
                    ImageUrl = "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80",
                    AltText = "Weekender duffel bag",
                    IsPrimary = true,
                    SortOrder = 1
                }
            ]
        };

        var laptopBriefcase = new Product
        {
            Title = "Laptop Briefcase",
            Slug = "laptop-briefcase",
            Description = "A structured work bag with a padded laptop section.",
            Price = 1840000m,
            StockQuantity = 14,
            Status = ProductStatus.Active,
            InventoryStatus = InventoryStatus.InStock,
            Category = workBags,
            Categories = CreateProductCategoryLinks(taxonomy, "laptop-bag", "office-bag", "work-bag", "men-bag", "formal-office-collection"),
            Brand = urbanCarry,
            Colors = [new ProductColor { CatalogColor = navy }],
            Images =
            [
                new ProductImage
                {
                    ImageUrl = "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80",
                    AltText = "Laptop briefcase",
                    IsPrimary = true,
                    SortOrder = 1
                }
            ]
        };

        var canvasTote = new Product
        {
            Title = "Canvas Tote",
            Slug = "canvas-tote",
            Description = "A durable canvas tote for shopping and daily carry.",
            Price = 620000m,
            StockQuantity = 5,
            Status = ProductStatus.Active,
            InventoryStatus = InventoryStatus.LowStock,
            Category = handbags,
            Categories = CreateProductCategoryLinks(taxonomy, "handbag", "canvas-bag", "shopping-bag", "women-bag", "economic-bags"),
            Brand = vendoraStudio,
            Colors = [new ProductColor { CatalogColor = green }, new ProductColor { CatalogColor = brown }],
            Images =
            [
                new ProductImage
                {
                    ImageUrl = "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80",
                    AltText = "Canvas tote bag",
                    IsPrimary = true,
                    SortOrder = 1
                }
            ]
        };

        var cabinSuitcase = new Product
        {
            Title = "Cabin Suitcase",
            Slug = "cabin-suitcase",
            Description = "A compact travel suitcase for short business trips.",
            Price = 2450000m,
            StockQuantity = 0,
            Status = ProductStatus.Active,
            InventoryStatus = InventoryStatus.OutOfStock,
            Category = travelBags,
            Categories = CreateProductCategoryLinks(taxonomy, "travel-bag", "waterproof-bag", "travel-use-bag", "men-bag", "luxury-bags"),
            Brand = urbanCarry,
            Colors = [new ProductColor { CatalogColor = black }],
            Images =
            [
                new ProductImage
                {
                    ImageUrl = "https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?auto=format&fit=crop&w=900&q=80",
                    AltText = "Cabin suitcase",
                    IsPrimary = true,
                    SortOrder = 1
                }
            ]
        };

        var showcaseProducts = CreateBagShowcaseProducts(
            taxonomy,
            new Dictionary<string, Brand>
            {
                [vendoraStudio.Slug] = vendoraStudio,
                [urbanCarry.Slug] = urbanCarry
            },
            new Dictionary<string, CatalogColor>
            {
                [black.Slug] = black,
                [brown.Slug] = brown,
                [green.Slug] = green,
                [navy.Slug] = navy
            },
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                leatherHandbag.Slug,
                cityBackpack.Slug,
                weekenderBag.Slug,
                laptopBriefcase.Slug,
                canvasTote.Slug,
                cabinSuitcase.Slug
            });

        var adminUser = new UserAccount
        {
            FullName = "Vendora Admin",
            Email = "admin@vendora.local",
            PhoneNumber = "09120000000",
            Role = UserRole.Admin
        };

        var customerUser = new UserAccount
        {
            FullName = "Test Customer",
            Email = "customer@vendora.local",
            PhoneNumber = "09121111111",
            Role = UserRole.Customer
        };

        var saraUser = new UserAccount
        {
            FullName = "Sara Ahmadi",
            Email = "sara.ahmadi@vendora.local",
            PhoneNumber = "09122222222",
            Role = UserRole.Customer
        };

        var aliUser = new UserAccount
        {
            FullName = "Ali Rezaei",
            Email = "ali.rezaei@vendora.local",
            PhoneNumber = "09123333333",
            Role = UserRole.Customer
        };

        var cart = new Cart
        {
            UserId = customerUser.Id,
            Items =
            [
                new CartItem
                {
                    ProductId = cityBackpack.Id,
                    ProductTitle = cityBackpack.Title,
                    UnitPrice = cityBackpack.Price,
                    Quantity = 1
                }
            ]
        };

        var order = new Order
        {
            UserId = customerUser.Id,
            OrderNumber = "ORD-SEED-0001",
            Status = OrderStatus.Paid,
            PaymentStatus = PaymentStatus.Verified,
            CurrencyCode = "TOMAN",
            ShippingCost = 150000m,
            DiscountAmount = 50000m,
            Items =
            [
                new OrderItem
                {
                    ProductId = leatherHandbag.Id,
                    ProductTitle = leatherHandbag.Title,
                    UnitPrice = leatherHandbag.Price,
                    Quantity = 1
                }
            ]
        };

        order.RecalculateTotals();

        var paymentTransaction = new PaymentTransaction
        {
            Order = order,
            Provider = PaymentProvider.Zarinpal,
            Authority = "TEST-AUTHORITY-0001",
            ReferenceId = "TEST-REF-0001",
            Amount = order.TotalAmount,
            Status = PaymentStatus.Verified
        };

        var processingOrder = new Order
        {
            UserId = saraUser.Id,
            OrderNumber = "ORD-SEED-0002",
            Status = OrderStatus.Processing,
            PaymentStatus = PaymentStatus.Verified,
            CurrencyCode = "TOMAN",
            ShippingCost = 180000m,
            DiscountAmount = 0m,
            Items =
            [
                new OrderItem
                {
                    ProductId = laptopBriefcase.Id,
                    ProductTitle = laptopBriefcase.Title,
                    UnitPrice = laptopBriefcase.Price,
                    Quantity = 1
                },
                new OrderItem
                {
                    ProductId = canvasTote.Id,
                    ProductTitle = canvasTote.Title,
                    UnitPrice = canvasTote.Price,
                    Quantity = 1
                }
            ]
        };

        processingOrder.RecalculateTotals();

        var processingPayment = new PaymentTransaction
        {
            Order = processingOrder,
            Provider = PaymentProvider.BankMelli,
            Authority = "TEST-AUTHORITY-0002",
            ReferenceId = "TEST-REF-0002",
            Amount = processingOrder.TotalAmount,
            Status = PaymentStatus.Verified
        };

        var pendingOrder = new Order
        {
            UserId = aliUser.Id,
            OrderNumber = "ORD-SEED-0003",
            Status = OrderStatus.PendingPayment,
            PaymentStatus = PaymentStatus.Pending,
            CurrencyCode = "TOMAN",
            ShippingCost = 120000m,
            DiscountAmount = 0m,
            Items =
            [
                new OrderItem
                {
                    ProductId = cityBackpack.Id,
                    ProductTitle = cityBackpack.Title,
                    UnitPrice = cityBackpack.Price,
                    Quantity = 1
                }
            ]
        };

        pendingOrder.RecalculateTotals();

        var pendingPayment = new PaymentTransaction
        {
            Order = pendingOrder,
            Provider = PaymentProvider.Zarinpal,
            Authority = "TEST-AUTHORITY-0003",
            Amount = pendingOrder.TotalAmount,
            Status = PaymentStatus.Pending
        };

        await dbContext.Categories.AddRangeAsync(
            [handbags, backpacks, travelBags, workBags, waterproofHuntingBags, pistolHuntingBags, .. taxonomy.Values],
            cancellationToken);
        await dbContext.Brands.AddRangeAsync([vendoraStudio, urbanCarry], cancellationToken);
        await dbContext.CatalogColors.AddRangeAsync([black, brown, green, navy], cancellationToken);
        await dbContext.Products.AddRangeAsync(
            [leatherHandbag, cityBackpack, weekenderBag, laptopBriefcase, canvasTote, cabinSuitcase, .. showcaseProducts],
            cancellationToken);
        await dbContext.UserAccounts.AddRangeAsync([adminUser, customerUser, saraUser, aliUser], cancellationToken);
        await dbContext.Carts.AddAsync(cart, cancellationToken);
        await dbContext.Orders.AddRangeAsync([order, processingOrder, pendingOrder], cancellationToken);
        await dbContext.PaymentTransactions.AddRangeAsync([paymentTransaction, processingPayment, pendingPayment], cancellationToken);

        await AddAdminTablesAsync(dbContext, taxonomy.Values.ToList(), cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static async Task SeedAdminTablesAsync(AppDbContext dbContext, CancellationToken cancellationToken)
    {
        await EnsureBagTaxonomyAsync(dbContext, cancellationToken);
        var categories = await dbContext.Categories.AsNoTracking().ToListAsync(cancellationToken);
        await AddAdminTablesAsync(dbContext, categories, cancellationToken);
        await EnsureBagShowcaseProductsAsync(dbContext, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static Dictionary<string, Category> CreateBagTaxonomy()
    {
        var specs = GetBagCategorySpecs();
        var categories = specs.ToDictionary(
            spec => spec.Slug,
            spec => new Category
            {
                Name = spec.Name,
                Slug = spec.Slug,
                IsActive = true
            });

        foreach (var spec in specs.Where(spec => spec.ParentSlug is not null))
        {
            categories[spec.Slug].ParentCategory = categories[spec.ParentSlug!];
        }

        return categories;
    }

    private static List<ProductCategory> CreateProductCategoryLinks(
        IReadOnlyDictionary<string, Category> categories,
        params string[] slugs)
    {
        return slugs
            .Where(categories.ContainsKey)
            .Distinct()
            .Select(slug => new ProductCategory { Category = categories[slug] })
            .ToList();
    }

    private static async Task EnsureBagShowcaseProductsAsync(AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var existingProductSlugs = (await dbContext.Products
                .AsNoTracking()
                .Select(product => product.Slug)
                .ToListAsync(cancellationToken))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var categories = (await dbContext.Categories.ToListAsync(cancellationToken))
            .Concat(dbContext.Categories.Local)
            .GroupBy(category => category.Slug)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var brands = (await dbContext.Brands.ToListAsync(cancellationToken))
            .Concat(dbContext.Brands.Local)
            .GroupBy(brand => brand.Slug)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var colors = (await dbContext.CatalogColors.ToListAsync(cancellationToken))
            .Concat(dbContext.CatalogColors.Local)
            .GroupBy(color => color.Slug)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

        var products = CreateBagShowcaseProducts(categories, brands, colors, existingProductSlugs);
        await SyncBagShowcaseProductImagesAsync(dbContext, cancellationToken);
        if (products.Count == 0)
        {
            return;
        }

        await dbContext.Products.AddRangeAsync(products, cancellationToken);
    }

    private static async Task SyncBagShowcaseProductImagesAsync(AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var expectedImages = GetBagShowcaseProductSpecs()
            .ToDictionary(spec => spec.Slug, spec => spec.ImageUrl, StringComparer.OrdinalIgnoreCase);

        var products = await dbContext.Products
            .Include(product => product.Images)
            .Where(product => expectedImages.Keys.Contains(product.Slug))
            .ToListAsync(cancellationToken);

        foreach (var product in products)
        {
            var expectedImageUrl = expectedImages[product.Slug];
            var primaryImage = product.Images
                .OrderByDescending(image => image.IsPrimary)
                .ThenBy(image => image.SortOrder)
                .FirstOrDefault();

            if (primaryImage is null)
            {
                product.Images.Add(new ProductImage
                {
                    ImageUrl = expectedImageUrl,
                    AltText = product.Title,
                    IsPrimary = true,
                    SortOrder = 1
                });
                continue;
            }

            primaryImage.ImageUrl = expectedImageUrl;
            primaryImage.AltText = product.Title;
            primaryImage.IsPrimary = true;
        }
    }

    private static List<Product> CreateBagShowcaseProducts(
        IReadOnlyDictionary<string, Category> categories,
        IReadOnlyDictionary<string, Brand> brands,
        IReadOnlyDictionary<string, CatalogColor> colors,
        IReadOnlySet<string> existingProductSlugs)
    {
        return GetBagShowcaseProductSpecs()
            .Where(spec => !existingProductSlugs.Contains(spec.Slug))
            .Select(spec => CreateBagShowcaseProduct(spec, categories, brands, colors))
            .Where(product => product is not null)
            .Select(product => product!)
            .ToList();
    }

    private static Product? CreateBagShowcaseProduct(
        ProductSeedSpec spec,
        IReadOnlyDictionary<string, Category> categories,
        IReadOnlyDictionary<string, Brand> brands,
        IReadOnlyDictionary<string, CatalogColor> colors)
    {
        var productCategories = spec.CategorySlugs
            .Where(categories.ContainsKey)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Select(slug => categories[slug])
            .ToList();

        if (productCategories.Count == 0)
        {
            return null;
        }

        var brand = brands.TryGetValue(spec.BrandSlug, out var selectedBrand)
            ? selectedBrand
            : brands.Values.FirstOrDefault();

        return new Product
        {
            Title = spec.Title,
            Slug = spec.Slug,
            Description = spec.Description,
            Price = spec.Price,
            StockQuantity = spec.StockQuantity,
            Status = ProductStatus.Active,
            InventoryStatus = spec.StockQuantity == 0 ? InventoryStatus.OutOfStock : spec.StockQuantity <= 5 ? InventoryStatus.LowStock : InventoryStatus.InStock,
            Category = productCategories[0],
            Brand = brand,
            Categories = productCategories.Select(category => new ProductCategory { Category = category }).ToList(),
            Colors = spec.ColorSlugs
                .Where(colors.ContainsKey)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(slug => new ProductColor { CatalogColor = colors[slug] })
                .ToList(),
            Images =
            [
                new ProductImage
                {
                    ImageUrl = spec.ImageUrl,
                    AltText = spec.Title,
                    IsPrimary = true,
                    SortOrder = 1
                }
            ]
        };
    }

    private static async Task EnsureBagTaxonomyAsync(AppDbContext dbContext, CancellationToken cancellationToken)
    {
        var specs = GetBagCategorySpecs();
        var existingCategories = await dbContext.Categories.ToListAsync(cancellationToken);
        var bySlug = existingCategories
            .Concat(dbContext.Categories.Local)
            .GroupBy(category => category.Slug)
            .ToDictionary(group => group.Key, group => group.First());

        foreach (var spec in specs)
        {
            if (!bySlug.TryGetValue(spec.Slug, out var category))
            {
                category = new Category
                {
                    Name = spec.Name,
                    Slug = spec.Slug,
                    IsActive = true
                };
                await dbContext.Categories.AddAsync(category, cancellationToken);
                bySlug[spec.Slug] = category;
            }
            else
            {
                category.Name = spec.Name;
                category.IsActive = true;
            }
        }

        foreach (var spec in specs.Where(spec => spec.ParentSlug is not null))
        {
            bySlug[spec.Slug].ParentCategory = bySlug[spec.ParentSlug!];
            bySlug[spec.Slug].ParentCategoryId = bySlug[spec.ParentSlug!].Id;
        }

        foreach (var obsoleteSlug in new[]
        {
            "handbags",
            "backpacks",
            "travel-bags",
            "work-bags",
            "waterproof-hunting-bags",
            "pistol-hunting-bags"
        })
        {
            if (bySlug.TryGetValue(obsoleteSlug, out var category))
            {
                category.IsActive = false;
            }
        }

        await SyncExistingProductCategoriesAsync(dbContext, bySlug, cancellationToken);
    }

    private static async Task SyncExistingProductCategoriesAsync(
        AppDbContext dbContext,
        IReadOnlyDictionary<string, Category> categories,
        CancellationToken cancellationToken)
    {
        var products = await dbContext.Products
            .Include(product => product.Categories)
            .ToListAsync(cancellationToken);

        foreach (var product in products)
        {
            var slugs = GuessCategorySlugsForProduct(product);
            if (slugs.Count == 0)
            {
                continue;
            }

            var targetCategoryIds = slugs
                .Where(categories.ContainsKey)
                .Select(slug => categories[slug].Id)
                .Distinct()
                .ToHashSet();

            if (targetCategoryIds.Count == 0)
            {
                continue;
            }

            product.CategoryId = targetCategoryIds.First();
            var currentCategoryIds = product.Categories.Select(link => link.CategoryId).ToHashSet();
            foreach (var categoryId in targetCategoryIds.Except(currentCategoryIds))
            {
                product.Categories.Add(new ProductCategory
                {
                    ProductId = product.Id,
                    CategoryId = categoryId
                });
            }
        }
    }

    private static IReadOnlyList<string> GuessCategorySlugsForProduct(Product product)
    {
        string slug = product.Slug;

        if (slug.Contains("backpack", StringComparison.OrdinalIgnoreCase))
        {
            return ["backpack", "fabric-bag", "student-bag", "unisex-bag", "new-models"];
        }

        if (slug.Contains("briefcase", StringComparison.OrdinalIgnoreCase) || slug.Contains("laptop", StringComparison.OrdinalIgnoreCase))
        {
            return ["laptop-bag", "office-bag", "work-bag", "men-bag", "formal-office-collection"];
        }

        if (slug.Contains("duffel", StringComparison.OrdinalIgnoreCase) || slug.Contains("suitcase", StringComparison.OrdinalIgnoreCase))
        {
            return ["travel-bag", "travel-use-bag", "unisex-bag", "summer-collection"];
        }

        if (slug.Contains("tote", StringComparison.OrdinalIgnoreCase))
        {
            return ["handbag", "canvas-bag", "shopping-bag", "women-bag", "economic-bags"];
        }

        if (slug.Contains("handbag", StringComparison.OrdinalIgnoreCase))
        {
            return ["women-handbag", "natural-leather-bag", "daily-bag", "women-bag", "best-sellers"];
        }

        return [];
    }

    private static IReadOnlyList<CategorySpec> GetBagCategorySpecs()
    {
        return
        [
            new("بر اساس نوع کیف", "by-bag-type", null),
            new("کیف دستی زنانه", "women-handbag", "by-bag-type"),
            new("کیف دوشی", "shoulder-bag", "by-bag-type"),
            new("کیف کوله‌پشتی", "backpack", "by-bag-type"),
            new("کیف پول", "wallet", "by-bag-type"),
            new("کیف کمری", "waist-bag", "by-bag-type"),
            new("کیف اداری", "office-bag", "by-bag-type"),
            new("کیف لپ‌تاپ", "laptop-bag", "by-bag-type"),
            new("کیف مسافرتی", "travel-bag", "by-bag-type"),
            new("کیف آرایشی", "cosmetic-bag", "by-bag-type"),
            new("کیف مجلسی", "evening-bag", "by-bag-type"),
            new("کیف ورزشی", "sport-bag", "by-bag-type"),
            new("ساک دستی", "hand-carry-bag", "by-bag-type"),

            new("بر اساس جنس", "by-material", null),
            new("کیف چرم طبیعی", "natural-leather-bag", "by-material"),
            new("کیف چرم مصنوعی", "faux-leather-bag", "by-material"),
            new("کیف پارچه‌ای", "fabric-bag", "by-material"),
            new("کیف برزنتی", "canvas-bag", "by-material"),
            new("کیف جیر", "suede-bag", "by-material"),
            new("کیف حصیری", "woven-bag", "by-material"),
            new("کیف مخمل", "velvet-bag", "by-material"),
            new("کیف ضدآب", "waterproof-bag", "by-material"),

            new("بر اساس کاربرد", "by-use-case", null),
            new("کیف روزمره", "daily-bag", "by-use-case"),
            new("کیف دانشجویی", "student-bag", "by-use-case"),
            new("کیف محل کار", "work-bag", "by-use-case"),
            new("کیف مهمانی و مجلسی", "party-evening-bag", "by-use-case"),
            new("کیف سفر", "travel-use-bag", "by-use-case"),
            new("کیف مادر و کودک", "mom-baby-bag", "by-use-case"),
            new("کیف خرید", "shopping-bag", "by-use-case"),
            new("کیف مدرسه", "school-bag", "by-use-case"),

            new("بر اساس مخاطب", "by-audience", null),
            new("کیف زنانه", "women-bag", "by-audience"),
            new("کیف مردانه", "men-bag", "by-audience"),
            new("کیف دخترانه", "girls-bag", "by-audience"),
            new("کیف پسرانه", "boys-bag", "by-audience"),
            new("کیف بچگانه", "kids-bag", "by-audience"),
            new("کیف اسپرت", "sporty-bag", "by-audience"),
            new("کیف یونیسکس", "unisex-bag", "by-audience"),

            new("دسته‌بندی‌های جذاب برای صفحه اصلی", "homepage-collections", null),
            new("پرفروش‌ترین‌ها", "best-sellers", "homepage-collections"),
            new("جدیدترین مدل‌ها", "new-models", "homepage-collections"),
            new("کیف‌های اقتصادی", "economic-bags", "homepage-collections"),
            new("کیف‌های لوکس", "luxury-bags", "homepage-collections"),
            new("مناسب هدیه", "gift-worthy", "homepage-collections"),
            new("تخفیف‌دارها", "discounted-bags", "homepage-collections"),
            new("کالکشن تابستانه", "summer-collection", "homepage-collections"),
            new("کالکشن رسمی و اداری", "formal-office-collection", "homepage-collections")
        ];
    }

    private static IReadOnlyList<ProductSeedSpec> GetBagShowcaseProductSpecs()
    {
        const string imageBase = "https://images.unsplash.com";

        var specs = new List<ProductSeedSpec>
        {
            new("Everyday Shoulder Bag", "seed-everyday-shoulder-bag", "A practical shoulder bag with a soft strap, zipper closure, and enough room for daily essentials.", 890000m, 18, $"{imageBase}/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["shoulder-bag", "faux-leather-bag", "daily-bag", "women-bag"], ["black", "brown"]),
            new("Compact Wallet Pouch", "seed-compact-wallet-pouch", "A compact wallet pouch for cards, cash, and small accessories with a clean minimal finish.", 320000m, 32, $"{imageBase}/photo-1601592996763-f05c9c80a7f9?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["wallet", "faux-leather-bag", "daily-bag", "unisex-bag"], ["brown"]),
            new("Urban Waist Bag", "seed-urban-waist-bag", "A lightweight waist bag designed for walking, commuting, and hands-free city use.", 540000m, 21, $"{imageBase}/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80", "urban-carry", ["waist-bag", "waterproof-bag", "sporty-bag", "men-bag"], ["black", "navy"]),
            new("Office Document Bag", "seed-office-document-bag", "A structured office bag for documents, tablet, charger, and daily work items.", 1420000m, 15, $"{imageBase}/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80", "urban-carry", ["office-bag", "faux-leather-bag", "work-bag", "formal-office-collection"], ["black"]),
            new("Soft Travel Organizer", "seed-soft-travel-organizer", "A medium travel organizer with separate pockets for clothing, cables, and toiletries.", 760000m, 17, $"{imageBase}/photo-1565026057447-bc90a3dceb87?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["travel-bag", "fabric-bag", "travel-use-bag", "unisex-bag"], ["navy"]),
            new("Cosmetic Vanity Bag", "seed-cosmetic-vanity-bag", "A washable cosmetic bag with a wide opening and inner divider for daily beauty products.", 410000m, 28, $"{imageBase}/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["cosmetic-bag", "waterproof-bag", "daily-bag", "women-bag"], ["green"]),
            new("Evening Clutch Bag", "seed-evening-clutch-bag", "A slim evening clutch with a refined finish for ceremonies, dinners, and formal events.", 1180000m, 9, $"{imageBase}/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["evening-bag", "velvet-bag", "party-evening-bag", "luxury-bags"], ["black"]),
            new("Training Gym Bag", "seed-training-gym-bag", "A durable gym bag with shoe storage, side pocket, and reinforced handles.", 960000m, 20, $"{imageBase}/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80", "urban-carry", ["sport-bag", "canvas-bag", "sporty-bag", "unisex-bag"], ["green", "black"]),
            new("Hand Carry Shopper", "seed-hand-carry-shopper", "A reliable hand-carry shopping bag made for repeat use and light weekend errands.", 380000m, 35, $"{imageBase}/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["hand-carry-bag", "fabric-bag", "shopping-bag", "economic-bags"], ["brown"]),

            new("Premium Natural Leather Satchel", "seed-premium-natural-leather-satchel", "A natural leather satchel with a timeless profile, polished hardware, and long-lasting stitching.", 2860000m, 7, $"{imageBase}/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["natural-leather-bag", "women-handbag", "work-bag", "luxury-bags"], ["brown"]),
            new("Vegan Leather Crossbody", "seed-vegan-leather-crossbody", "A vegan leather crossbody bag with adjustable strap and daily-friendly storage.", 980000m, 19, $"{imageBase}/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80", "urban-carry", ["faux-leather-bag", "shoulder-bag", "daily-bag", "women-bag"], ["black"]),
            new("Light Fabric Student Tote", "seed-light-fabric-student-tote", "A light fabric tote for notebooks, tablet, and everyday study essentials.", 470000m, 31, $"{imageBase}/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["fabric-bag", "student-bag", "handbag", "economic-bags"], ["green"]),
            new("Heavy Canvas Field Bag", "seed-heavy-canvas-field-bag", "A sturdy canvas field bag with reinforced base and practical compartments.", 1320000m, 12, $"{imageBase}/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80", "urban-carry", ["canvas-bag", "travel-bag", "travel-use-bag", "men-bag"], ["green", "black"]),
            new("Soft Suede Mini Bag", "seed-soft-suede-mini-bag", "A soft suede mini bag for light daily carry and refined casual styling.", 1240000m, 10, $"{imageBase}/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["suede-bag", "shoulder-bag", "daily-bag", "women-bag"], ["brown"]),
            new("Woven Summer Basket Bag", "seed-woven-summer-basket-bag", "A woven basket-style bag made for summer outfits, market walks, and beach days.", 690000m, 16, $"{imageBase}/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["woven-bag", "handbag", "summer-collection", "women-bag"], ["brown"]),
            new("Velvet Ceremony Pouch", "seed-velvet-ceremony-pouch", "A velvet pouch with a soft hand feel and elegant silhouette for formal occasions.", 870000m, 13, $"{imageBase}/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["velvet-bag", "evening-bag", "party-evening-bag", "gift-worthy"], ["black"]),
            new("Waterproof Commuter Pack", "seed-waterproof-commuter-pack", "A waterproof commuter pack with sealed fabric, laptop sleeve, and rain-ready zippers.", 1680000m, 11, $"{imageBase}/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", "urban-carry", ["waterproof-bag", "backpack", "work-bag", "unisex-bag"], ["navy", "black"]),

            new("Daily Minimal Carryall", "seed-daily-minimal-carryall", "A minimal carryall for phone, wallet, keys, and everyday commuting.", 650000m, 24, $"{imageBase}/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["daily-bag", "shoulder-bag", "faux-leather-bag", "women-bag"], ["black"]),
            new("Campus Laptop Backpack", "seed-campus-laptop-backpack", "A campus backpack with laptop sleeve, bottle pocket, and organized inner storage.", 1190000m, 22, $"{imageBase}/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", "urban-carry", ["student-bag", "backpack", "laptop-bag", "unisex-bag"], ["navy"]),
            new("Meeting Day Work Bag", "seed-meeting-day-work-bag", "A polished work bag for meetings, documents, laptop, and daily office carry.", 1750000m, 14, $"{imageBase}/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80", "urban-carry", ["work-bag", "office-bag", "laptop-bag", "formal-office-collection"], ["black"]),
            new("Party Metallic Mini Bag", "seed-party-metallic-mini-bag", "A small party bag with compact storage for formal events and evening outfits.", 1120000m, 8, $"{imageBase}/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["party-evening-bag", "evening-bag", "velvet-bag", "luxury-bags"], ["black"]),
            new("Weekend Travel Duffel", "seed-weekend-travel-duffel", "A weekend duffel with large main compartment and easy-access side pocket.", 1490000m, 18, $"{imageBase}/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80", "urban-carry", ["travel-use-bag", "travel-bag", "canvas-bag", "unisex-bag"], ["green"]),
            new("Mother Baby Organizer Bag", "seed-mother-baby-organizer-bag", "A mother and baby organizer with bottle pockets, wipe pocket, and spacious inner layout.", 1380000m, 13, $"{imageBase}/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["mom-baby-bag", "waterproof-bag", "handbag", "women-bag"], ["navy"]),
            new("Reusable Market Bag", "seed-reusable-market-bag", "A reusable market bag with reinforced stitching for daily shopping and grocery runs.", 290000m, 40, $"{imageBase}/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["shopping-bag", "hand-carry-bag", "fabric-bag", "economic-bags"], ["green"]),
            new("Durable School Backpack", "seed-durable-school-backpack", "A durable school backpack with book-friendly compartments and soft shoulder straps.", 840000m, 26, $"{imageBase}/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", "urban-carry", ["school-bag", "backpack", "fabric-bag", "kids-bag"], ["navy"]),

            new("Classic Women Tote", "seed-classic-women-tote", "A classic women tote with a clean profile for work, daily errands, and weekend plans.", 990000m, 20, $"{imageBase}/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["women-bag", "handbag", "daily-bag", "gift-worthy"], ["brown"]),
            new("Men Executive Brief Bag", "seed-men-executive-brief-bag", "A men executive brief bag with document space, laptop protection, and formal finish.", 1920000m, 12, $"{imageBase}/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80", "urban-carry", ["men-bag", "office-bag", "work-bag", "formal-office-collection"], ["black"]),
            new("Girls Pastel Shoulder Bag", "seed-girls-pastel-shoulder-bag", "A small shoulder bag with playful styling for girls and light everyday use.", 520000m, 18, $"{imageBase}/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["girls-bag", "shoulder-bag", "fabric-bag", "daily-bag"], ["brown"]),
            new("Boys Sport Backpack", "seed-boys-sport-backpack", "A sporty backpack for boys with a compact size and practical daily compartments.", 730000m, 19, $"{imageBase}/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", "urban-carry", ["boys-bag", "backpack", "sporty-bag", "school-bag"], ["navy"]),
            new("Kids Animal Mini Pack", "seed-kids-animal-mini-pack", "A mini kids backpack with soft straps and cheerful styling for preschool essentials.", 460000m, 25, $"{imageBase}/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["kids-bag", "backpack", "school-bag", "gift-worthy"], ["green"]),
            new("Sporty Sling Bag", "seed-sporty-sling-bag", "A sporty sling bag made for quick access during walks, workouts, and travel.", 610000m, 23, $"{imageBase}/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80", "urban-carry", ["sporty-bag", "waist-bag", "waterproof-bag", "unisex-bag"], ["black"]),
            new("Unisex Rolltop Backpack", "seed-unisex-rolltop-backpack", "A unisex rolltop backpack with flexible capacity and durable daily construction.", 1540000m, 16, $"{imageBase}/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", "urban-carry", ["unisex-bag", "backpack", "waterproof-bag", "new-models"], ["navy", "black"]),

            new("Bestseller City Tote", "seed-bestseller-city-tote", "A best-selling city tote with balanced size, durable handles, and everyday styling.", 870000m, 30, $"{imageBase}/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["best-sellers", "handbag", "daily-bag", "women-bag"], ["brown"]),
            new("New Season Mini Backpack", "seed-new-season-mini-backpack", "A new-season mini backpack with updated stitching and compact urban proportions.", 940000m, 21, $"{imageBase}/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80", "urban-carry", ["new-models", "backpack", "fabric-bag", "girls-bag"], ["green"]),
            new("Budget Shopper Tote", "seed-budget-shopper-tote", "An affordable shopper tote with simple construction and dependable daily capacity.", 240000m, 45, $"{imageBase}/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["economic-bags", "shopping-bag", "fabric-bag", "hand-carry-bag"], ["green"]),
            new("Luxury Leather Doctor Bag", "seed-luxury-leather-doctor-bag", "A luxury leather doctor-style bag with structured body and premium hand-finished detail.", 3650000m, 5, $"{imageBase}/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["luxury-bags", "natural-leather-bag", "work-bag", "women-bag"], ["brown"]),
            new("Gift Box Mini Satchel", "seed-gift-box-mini-satchel", "A gift-ready mini satchel with elegant proportions and easy everyday usability.", 790000m, 17, $"{imageBase}/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["gift-worthy", "shoulder-bag", "faux-leather-bag", "women-bag"], ["black"]),
            new("Discount Canvas Crossbody", "seed-discount-canvas-crossbody", "A discounted canvas crossbody bag with everyday durability and simple styling.", 390000m, 34, $"{imageBase}/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=900&q=80", "urban-carry", ["discounted-bags", "canvas-bag", "daily-bag", "unisex-bag"], ["green"]),
            new("Summer Straw Beach Bag", "seed-summer-straw-beach-bag", "A summer beach bag with woven texture, roomy shape, and relaxed seasonal character.", 720000m, 14, $"{imageBase}/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=80", "vendora-studio", ["summer-collection", "woven-bag", "travel-use-bag", "women-bag"], ["brown"]),
            new("Formal Office Laptop Tote", "seed-formal-office-laptop-tote", "A formal laptop tote with slim lines, padded storage, and clean office-ready design.", 2150000m, 11, $"{imageBase}/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=900&q=80", "urban-carry", ["formal-office-collection", "laptop-bag", "work-bag", "men-bag"], ["black"])
        };

        var imageUrls = GetUniqueTemplateProductImages();
        return specs
            .Select((spec, index) => spec with { ImageUrl = imageUrls[index % imageUrls.Count] })
            .ToList();
    }

    private static IReadOnlyList<string> GetUniqueTemplateProductImages()
    {
        return
        [
            "https://i.ibb.co/KjVfq5j/product-17.jpg",
            "https://i.ibb.co/Fn76XBt/product-rel-17-1.jpg",
            "https://i.ibb.co/q5tWD7B/product-rel-17-2.jpg",
            "https://i.ibb.co/7Y8dxKZ/product-rel-17-3.jpg",
            "https://i.ibb.co/5FGVYm3/product-20.jpg",
            "https://i.ibb.co/QmrC1Wx/product-rel-20-3.jpg",
            "https://i.ibb.co/7C70Fk1/product-rel-20-1.jpg",
            "https://i.ibb.co/QdbqNs2/product-rel-20-2.jpg",
            "https://i.ibb.co/F3hPQMP/product-2.jpg",
            "https://i.ibb.co/rfjqtKv/product-rel-2-1.jpg",
            "https://i.ibb.co/Q89k5Jq/product-rel-2-2.jpg",
            "https://i.ibb.co/72h2zSp/product-rel-2-3.jpg",
            "https://i.ibb.co/FhzmCxJ/product-3.jpg",
            "https://i.ibb.co/1XMnN9N/product-rel-3-3.jpg",
            "https://i.ibb.co/nctKTQn/product-rel-3-2.jpg",
            "https://i.ibb.co/3z9WypX/product-rel-3-1.jpg",
            "https://i.ibb.co/ncm9NFx/product-6.jpg",
            "https://i.ibb.co/y6w6TkJ/product-rel-6-1.jpg",
            "https://i.ibb.co/BP1Y7XK/product-rel-6-2.jpg",
            "https://i.ibb.co/WxXmTNt/product-rel-6-3.jpg",
            "https://i.ibb.co/chbrFCn/product-14.jpg",
            "https://i.ibb.co/khwnyH4/product-rel-14-1.jpg",
            "https://i.ibb.co/ZKXqvXH/product-rel-14-2.jpg",
            "https://i.ibb.co/0hMKtrT/product-rel-14-3.jpg",
            "https://i.ibb.co/zJnrwrK/product-21.jpg",
            "https://i.ibb.co/TMPjtFq/product-rel-21-1.jpg",
            "https://i.ibb.co/fvC40Qt/product-rel-21-2.jpg",
            "https://i.ibb.co/8BfKR1r/product-rel-21-3.jpg",
            "https://i.ibb.co/cLbzchR/product-rel-21-4.jpg",
            "https://i.ibb.co/2ZZ6hxW/product-27.jpg",
            "https://i.ibb.co/hgXyFqZ/product-rel-27-3.jpg",
            "https://i.ibb.co/wz2WLCH/product-rel-27-4.jpg",
            "https://i.ibb.co/B6K9HDD/product-rel-27-1.jpg",
            "https://i.ibb.co/gVCmxLf/product-rel-27-2.jpg",
            "https://i.ibb.co/SBx55HB/product-16.jpg",
            "https://i.ibb.co/gySZN6f/product-rel-16-1.jpg",
            "https://i.ibb.co/2nFyx9f/product-rel-16-2.jpg",
            "https://i.ibb.co/6RqsZRp/product-rel-16-3.jpg",
            "https://i.ibb.co/mCKTs61/product-23.jpg",
            "https://i.ibb.co/7yvNhQS/product-rel-23-2.jpg",
            "https://i.ibb.co/z8JJtJN/product-rel-23-3.jpg",
            "https://i.ibb.co/4tKmcCH/product-rel-23-4.jpg",
            "https://i.ibb.co/5YYB2jG/product-rel-23-1.jpg",
            "https://i.ibb.co/qxYc8ts/product-25.jpg",
            "https://i.ibb.co/kQXkMXk/product-rel-25-2.jpg",
            "https://i.ibb.co/Hn9dfTZ/product-rel-25-3.jpg",
            "https://i.ibb.co/rkVMD0Z/product-rel-25-4.jpg",
            "https://i.ibb.co/r7S9nQK/product-rel-25-1.jpg",
            "https://i.ibb.co/2dDcxYr/product-1.jpg",
            "https://i.ibb.co/P5TktYw/product-rel-2.jpg",
            "https://i.ibb.co/Jtd2MSM/product-rel-3.jpg",
            "https://i.ibb.co/dpfGZjW/product-rel-1.jpg",
            "https://i.ibb.co/zR5hfxR/product-7.jpg",
            "https://i.ibb.co/zQF5dfK/product-rel-7-1.jpg",
            "https://i.ibb.co/cxxqWPw/product-rel-7-2.jpg",
            "https://i.ibb.co/S79d1H8/product-rel-7-3.jpg",
            "https://i.ibb.co/FWFHb8W/product-9.jpg",
            "https://i.ibb.co/8zmD3LW/product-rel-9-3.jpg",
            "https://i.ibb.co/Rhsg2YB/product-rel-9-2.jpg",
            "https://i.ibb.co/MpGW3j6/product-rel-9-1.jpg"
        ];
    }

    private sealed record CategorySpec(string Name, string Slug, string? ParentSlug);

    private sealed record ProductSeedSpec(
        string Title,
        string Slug,
        string Description,
        decimal Price,
        int StockQuantity,
        string ImageUrl,
        string BrandSlug,
        IReadOnlyList<string> CategorySlugs,
        IReadOnlyList<string> ColorSlugs);

    private static async Task AddAdminTablesAsync(AppDbContext dbContext, IReadOnlyList<Category> categories, CancellationToken cancellationToken)
    {
        if (!dbContext.Brands.Local.Any() && !await dbContext.Brands.AsNoTracking().AnyAsync(cancellationToken))
        {
            await dbContext.Brands.AddRangeAsync(
                [
                    new Brand
                    {
                        Name = "Vendora Studio",
                        Slug = "vendora-studio",
                        LogoUrl = "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=300&q=80",
                        Email = "brand@vendora.local",
                        Website = "https://vendora.local",
                        Description = "Internal bag manufacturing brand.",
                        Location = "Tehran",
                        IsActive = true
                    },
                    new Brand
                    {
                        Name = "Urban Carry",
                        Slug = "urban-carry",
                        LogoUrl = "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=300&q=80",
                        Description = "Everyday bags for city life.",
                        Location = "Karaj",
                        IsActive = true
                    },
                    new Brand
                    {
                        Name = "Archive Label",
                        Slug = "archive-label",
                        Description = "Inactive demo brand for admin filtering.",
                        IsActive = false
                    }
                ],
                cancellationToken);
        }

        if (!dbContext.CatalogColors.Local.Any() && !await dbContext.CatalogColors.AsNoTracking().AnyAsync(cancellationToken))
        {
            await dbContext.CatalogColors.AddRangeAsync(
                [
                    new CatalogColor { Name = "Black", Slug = "black", HexCode = "#111827", IsActive = true },
                    new CatalogColor { Name = "Brown", Slug = "brown", HexCode = "#92400e", IsActive = true },
                    new CatalogColor { Name = "Green", Slug = "green", HexCode = "#047857", IsActive = true },
                    new CatalogColor { Name = "Navy", Slug = "navy", HexCode = "#1e3a8a", IsActive = true }
                ],
                cancellationToken);
        }

        if (!await dbContext.Coupons.AsNoTracking().AnyAsync(cancellationToken))
        {
            var activeCategoryIds = categories.Where(category => category.IsActive).Select(category => category.Id).Take(2).ToList();
            var categoryCoupon = new Coupon
            {
                Title = "Bag Launch Offer",
                Code = "BAG20",
                DiscountPercent = 20m,
                MaxDiscountAmount = 250000m,
                ExpiresAtUtc = DateTime.UtcNow.AddMonths(2),
                IsActive = true,
                AppliesToAllCategories = false,
                Categories = activeCategoryIds.Select(categoryId => new CouponCategory { CategoryId = categoryId }).ToList()
            };

            await dbContext.Coupons.AddRangeAsync(
                [
                    new Coupon
                    {
                        Title = "Welcome Discount",
                        Code = "WELCOME10",
                        DiscountPercent = 10m,
                        MaxDiscountAmount = 150000m,
                        ExpiresAtUtc = DateTime.UtcNow.AddMonths(1),
                        IsActive = true,
                        AppliesToAllCategories = true
                    },
                    categoryCoupon,
                    new Coupon
                    {
                        Title = "Expired Campaign",
                        Code = "OLD5",
                        DiscountPercent = 5m,
                        MaxDiscountAmount = 50000m,
                        ExpiresAtUtc = DateTime.UtcNow.AddDays(-7),
                        IsActive = false,
                        AppliesToAllCategories = true
                    }
                ],
                cancellationToken);
        }
    }
}
