using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSeedDataVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "HideSeedData",
                table: "SeoSettings",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "SeedRecords",
                columns: table => new
                {
                    EntityType = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                    EntityId = table.Column<Guid>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeedRecords", x => new { x.EntityType, x.EntityId });
                });

            migrationBuilder.UpdateData(
                table: "SeoSettings",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"),
                column: "HideSeedData",
                value: false);

            // Frozen legacy seed manifest: no current names/prefix guesses are used at read time.
            migrationBuilder.Sql("""
                INSERT INTO "SeedRecords" ("EntityType", "EntityId") SELECT 'Product', x."Id" FROM "Products" x WHERE x."Slug" IN ('seed-bestseller-city-tote', 'seed-boys-sport-backpack', 'seed-budget-shopper-tote', 'seed-campus-laptop-backpack', 'seed-classic-women-tote', 'seed-compact-wallet-pouch', 'seed-cosmetic-vanity-bag', 'seed-daily-minimal-carryall', 'seed-discount-canvas-crossbody', 'seed-durable-school-backpack', 'seed-evening-clutch-bag', 'seed-everyday-shoulder-bag', 'seed-formal-office-laptop-tote', 'seed-gift-box-mini-satchel', 'seed-girls-pastel-shoulder-bag', 'seed-hand-carry-shopper', 'seed-heavy-canvas-field-bag', 'seed-kids-animal-mini-pack', 'seed-light-fabric-student-tote', 'seed-luxury-leather-doctor-bag', 'seed-meeting-day-work-bag', 'seed-men-executive-brief-bag', 'seed-mother-baby-organizer-bag', 'seed-new-season-mini-backpack', 'seed-office-document-bag', 'seed-party-metallic-mini-bag', 'seed-premium-natural-leather-satchel', 'seed-reusable-market-bag', 'seed-soft-suede-mini-bag', 'seed-soft-travel-organizer', 'seed-sporty-sling-bag', 'seed-summer-straw-beach-bag', 'seed-training-gym-bag', 'seed-unisex-rolltop-backpack', 'seed-urban-waist-bag', 'seed-vegan-leather-crossbody', 'seed-velvet-ceremony-pouch', 'seed-waterproof-commuter-pack', 'seed-weekend-travel-duffel', 'seed-woven-summer-basket-bag') OR x."Id" IN (SELECT "EntityId" FROM "SlugHistories" WHERE "Kind" = 'product' AND "Slug" IN ('seed-bestseller-city-tote', 'seed-boys-sport-backpack', 'seed-budget-shopper-tote', 'seed-campus-laptop-backpack', 'seed-classic-women-tote', 'seed-compact-wallet-pouch', 'seed-cosmetic-vanity-bag', 'seed-daily-minimal-carryall', 'seed-discount-canvas-crossbody', 'seed-durable-school-backpack', 'seed-evening-clutch-bag', 'seed-everyday-shoulder-bag', 'seed-formal-office-laptop-tote', 'seed-gift-box-mini-satchel', 'seed-girls-pastel-shoulder-bag', 'seed-hand-carry-shopper', 'seed-heavy-canvas-field-bag', 'seed-kids-animal-mini-pack', 'seed-light-fabric-student-tote', 'seed-luxury-leather-doctor-bag', 'seed-meeting-day-work-bag', 'seed-men-executive-brief-bag', 'seed-mother-baby-organizer-bag', 'seed-new-season-mini-backpack', 'seed-office-document-bag', 'seed-party-metallic-mini-bag', 'seed-premium-natural-leather-satchel', 'seed-reusable-market-bag', 'seed-soft-suede-mini-bag', 'seed-soft-travel-organizer', 'seed-sporty-sling-bag', 'seed-summer-straw-beach-bag', 'seed-training-gym-bag', 'seed-unisex-rolltop-backpack', 'seed-urban-waist-bag', 'seed-vegan-leather-crossbody', 'seed-velvet-ceremony-pouch', 'seed-waterproof-commuter-pack', 'seed-weekend-travel-duffel', 'seed-woven-summer-basket-bag'));
                INSERT INTO "SeedRecords" ("EntityType", "EntityId") SELECT 'Product', x."Id" FROM "Products" x WHERE ((x."Slug" = 'leather-handbag' AND (x."Title" = 'Leather Handbag' OR x."Description" = 'A compact leather handbag for everyday use.')) OR (x."Slug" = 'city-backpack' AND (x."Title" = 'City Backpack' OR x."Description" = 'A lightweight backpack designed for daily commuting.')) OR (x."Slug" = 'weekender-duffel' AND (x."Title" = 'Weekender Duffel' OR x."Description" = 'A spacious duffel bag for short trips and weekend travel.')) OR (x."Slug" = 'laptop-briefcase' AND (x."Title" = 'Laptop Briefcase' OR x."Description" = 'A structured work bag with a padded laptop section.')) OR (x."Slug" = 'canvas-tote' AND (x."Title" = 'Canvas Tote' OR x."Description" = 'A simple reusable tote for shopping and daily essentials.')) OR (x."Slug" = 'cabin-suitcase' AND (x."Title" = 'Cabin Suitcase' OR x."Description" = 'A compact suitcase with durable wheels for short travel.'))) AND NOT EXISTS (SELECT 1 FROM "SeedRecords" s WHERE s."EntityType" = 'Product' AND s."EntityId" = x."Id");
                INSERT INTO "SeedRecords" ("EntityType", "EntityId") SELECT 'Category', x."Id" FROM "Categories" x WHERE (x."Slug" = 'by-bag-type' AND x."Name" = 'بر اساس نوع کیف') OR (x."Slug" = 'women-handbag' AND x."Name" = 'کیف دستی زنانه') OR (x."Slug" = 'shoulder-bag' AND x."Name" = 'کیف دوشی') OR (x."Slug" = 'backpack' AND x."Name" = 'کیف کوله‌پشتی') OR (x."Slug" = 'wallet' AND x."Name" = 'کیف پول') OR (x."Slug" = 'waist-bag' AND x."Name" = 'کیف کمری') OR (x."Slug" = 'office-bag' AND x."Name" = 'کیف اداری') OR (x."Slug" = 'laptop-bag' AND x."Name" = 'کیف لپ‌تاپ') OR (x."Slug" = 'travel-bag' AND x."Name" = 'کیف مسافرتی') OR (x."Slug" = 'cosmetic-bag' AND x."Name" = 'کیف آرایشی') OR (x."Slug" = 'evening-bag' AND x."Name" = 'کیف مجلسی') OR (x."Slug" = 'sport-bag' AND x."Name" = 'کیف ورزشی') OR (x."Slug" = 'hand-carry-bag' AND x."Name" = 'ساک دستی') OR (x."Slug" = 'by-material' AND x."Name" = 'بر اساس جنس') OR (x."Slug" = 'natural-leather-bag' AND x."Name" = 'کیف چرم طبیعی') OR (x."Slug" = 'faux-leather-bag' AND x."Name" = 'کیف چرم مصنوعی') OR (x."Slug" = 'fabric-bag' AND x."Name" = 'کیف پارچه‌ای') OR (x."Slug" = 'canvas-bag' AND x."Name" = 'کیف برزنتی') OR (x."Slug" = 'suede-bag' AND x."Name" = 'کیف جیر') OR (x."Slug" = 'woven-bag' AND x."Name" = 'کیف حصیری') OR (x."Slug" = 'velvet-bag' AND x."Name" = 'کیف مخمل') OR (x."Slug" = 'waterproof-bag' AND x."Name" = 'کیف ضدآب') OR (x."Slug" = 'by-use-case' AND x."Name" = 'بر اساس کاربرد') OR (x."Slug" = 'daily-bag' AND x."Name" = 'کیف روزمره') OR (x."Slug" = 'student-bag' AND x."Name" = 'کیف دانشجویی') OR (x."Slug" = 'work-bag' AND x."Name" = 'کیف محل کار') OR (x."Slug" = 'party-evening-bag' AND x."Name" = 'کیف مهمانی و مجلسی') OR (x."Slug" = 'travel-use-bag' AND x."Name" = 'کیف سفر') OR (x."Slug" = 'mom-baby-bag' AND x."Name" = 'کیف مادر و کودک') OR (x."Slug" = 'shopping-bag' AND x."Name" = 'کیف خرید') OR (x."Slug" = 'school-bag' AND x."Name" = 'کیف مدرسه') OR (x."Slug" = 'by-audience' AND x."Name" = 'بر اساس مخاطب') OR (x."Slug" = 'women-bag' AND x."Name" = 'کیف زنانه') OR (x."Slug" = 'men-bag' AND x."Name" = 'کیف مردانه') OR (x."Slug" = 'girls-bag' AND x."Name" = 'کیف دخترانه') OR (x."Slug" = 'boys-bag' AND x."Name" = 'کیف پسرانه') OR (x."Slug" = 'kids-bag' AND x."Name" = 'کیف بچگانه') OR (x."Slug" = 'sporty-bag' AND x."Name" = 'کیف اسپرت') OR (x."Slug" = 'unisex-bag' AND x."Name" = 'کیف یونیسکس') OR (x."Slug" = 'homepage-collections' AND x."Name" = 'دسته‌بندی‌های جذاب برای صفحه اصلی') OR (x."Slug" = 'best-sellers' AND x."Name" = 'پرفروش‌ترین‌ها') OR (x."Slug" = 'new-models' AND x."Name" = 'جدیدترین مدل‌ها') OR (x."Slug" = 'economic-bags' AND x."Name" = 'کیف‌های اقتصادی') OR (x."Slug" = 'luxury-bags' AND x."Name" = 'کیف‌های لوکس') OR (x."Slug" = 'gift-worthy' AND x."Name" = 'مناسب هدیه') OR (x."Slug" = 'discounted-bags' AND x."Name" = 'تخفیف‌دارها') OR (x."Slug" = 'summer-collection' AND x."Name" = 'کالکشن تابستانه') OR (x."Slug" = 'formal-office-collection' AND x."Name" = 'کالکشن رسمی و اداری') OR (x."Slug" = 'handbags' AND x."Name" = 'Handbags') OR (x."Slug" = 'backpacks' AND x."Name" = 'Backpacks') OR (x."Slug" = 'travel-bags' AND x."Name" = 'Travel Bags') OR (x."Slug" = 'work-bags' AND x."Name" = 'Work Bags') OR (x."Slug" = 'waterproof-hunting-bags' AND x."Name" = 'Waterproof Hunting Bags') OR (x."Slug" = 'pistol-hunting-bags' AND x."Name" = 'Pistol Hunting Bags');
                INSERT INTO "SeedRecords" ("EntityType", "EntityId") SELECT 'Brand', x."Id" FROM "Brands" x WHERE (x."Slug" = 'vendora-studio' AND x."Name" = 'Vendora Studio') OR (x."Slug" = 'urban-carry' AND x."Name" = 'Urban Carry') OR (x."Slug" = 'archive-label' AND x."Name" = 'Archive Label');
                INSERT INTO "SeedRecords" ("EntityType", "EntityId") SELECT 'CatalogColor', x."Id" FROM "CatalogColors" x WHERE (x."Slug" = 'black' AND x."Name" = 'Black') OR (x."Slug" = 'brown' AND x."Name" = 'Brown') OR (x."Slug" = 'green' AND x."Name" = 'Green') OR (x."Slug" = 'navy' AND x."Name" = 'Navy');
                INSERT INTO "SeedRecords" ("EntityType", "EntityId") SELECT 'UserAccount', x."Id" FROM "UserAccounts" x WHERE x."Email" IN ('admin@vendora.local', 'customer@vendora.local', 'sara.ahmadi@vendora.local', 'ali.rezaei@vendora.local');
                INSERT INTO "SeedRecords" ("EntityType", "EntityId") SELECT 'Order', x."Id" FROM "Orders" x WHERE x."OrderNumber" IN ('ORD-SEED-0001', 'ORD-SEED-0002', 'ORD-SEED-0003');
                INSERT INTO "SeedRecords" ("EntityType", "EntityId") SELECT 'PaymentTransaction', x."Id" FROM "PaymentTransactions" x WHERE x."OrderId" IN (SELECT "EntityId" FROM "SeedRecords" WHERE "EntityType" = 'Order') AND x."Authority" IN ('TEST-AUTHORITY-0001', 'TEST-AUTHORITY-0002', 'TEST-AUTHORITY-0003');
                INSERT INTO "SeedRecords" ("EntityType", "EntityId") SELECT 'Coupon', x."Id" FROM "Coupons" x WHERE (x."Code" = 'WELCOME10' AND x."Title" = 'Welcome Discount') OR (x."Code" = 'BAG20' AND x."Title" = 'Bag Launch Offer') OR (x."Code" = 'OLD5' AND x."Title" = 'Expired Campaign');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SeedRecords");

            migrationBuilder.DropColumn(
                name: "HideSeedData",
                table: "SeoSettings");
        }
    }
}
