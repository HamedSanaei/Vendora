using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations;

/// <summary>
/// Creates the initial Vendora schema.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260616000000_InitialCreate")]
public partial class InitialCreate : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Categories",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                Name = table.Column<string>(type: "TEXT", maxLength: 150, nullable: false),
                Slug = table.Column<string>(type: "TEXT", maxLength: 180, nullable: false),
                IsActive = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Categories", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "Carts",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                UserId = table.Column<Guid>(type: "TEXT", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Carts", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "Orders",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                UserId = table.Column<Guid>(type: "TEXT", nullable: true),
                OrderNumber = table.Column<string>(type: "TEXT", maxLength: 50, nullable: false),
                Status = table.Column<int>(type: "INTEGER", nullable: false),
                PaymentStatus = table.Column<int>(type: "INTEGER", nullable: false),
                CurrencyCode = table.Column<string>(type: "TEXT", maxLength: 3, nullable: false),
                Subtotal = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                ShippingCost = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                DiscountAmount = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                TotalAmount = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Orders", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "UserAccounts",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                FullName = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                Email = table.Column<string>(type: "TEXT", maxLength: 320, nullable: false),
                PhoneNumber = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                Role = table.Column<int>(type: "INTEGER", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_UserAccounts", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "Products",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                Title = table.Column<string>(type: "TEXT", maxLength: 250, nullable: false),
                Slug = table.Column<string>(type: "TEXT", maxLength: 280, nullable: false),
                Description = table.Column<string>(type: "TEXT", maxLength: 4000, nullable: true),
                Price = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                StockQuantity = table.Column<int>(type: "INTEGER", nullable: false),
                Status = table.Column<int>(type: "INTEGER", nullable: false),
                InventoryStatus = table.Column<int>(type: "INTEGER", nullable: false),
                CategoryId = table.Column<Guid>(type: "TEXT", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Products", x => x.Id);
                table.ForeignKey(
                    name: "FK_Products_Categories_CategoryId",
                    column: x => x.CategoryId,
                    principalTable: "Categories",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.SetNull);
            });

        migrationBuilder.CreateTable(
            name: "CartItems",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                CartId = table.Column<Guid>(type: "TEXT", nullable: false),
                ProductId = table.Column<Guid>(type: "TEXT", nullable: false),
                ProductTitle = table.Column<string>(type: "TEXT", maxLength: 250, nullable: false),
                UnitPrice = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                Quantity = table.Column<int>(type: "INTEGER", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CartItems", x => x.Id);
                table.ForeignKey(
                    name: "FK_CartItems_Carts_CartId",
                    column: x => x.CartId,
                    principalTable: "Carts",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "OrderItems",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                OrderId = table.Column<Guid>(type: "TEXT", nullable: false),
                ProductId = table.Column<Guid>(type: "TEXT", nullable: false),
                ProductTitle = table.Column<string>(type: "TEXT", maxLength: 250, nullable: false),
                UnitPrice = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                Quantity = table.Column<int>(type: "INTEGER", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_OrderItems", x => x.Id);
                table.ForeignKey(
                    name: "FK_OrderItems_Orders_OrderId",
                    column: x => x.OrderId,
                    principalTable: "Orders",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "PaymentTransactions",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                OrderId = table.Column<Guid>(type: "TEXT", nullable: false),
                Provider = table.Column<int>(type: "INTEGER", nullable: false),
                Authority = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                ReferenceId = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                Amount = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                Status = table.Column<int>(type: "INTEGER", nullable: false),
                FailureReason = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PaymentTransactions", x => x.Id);
                table.ForeignKey(
                    name: "FK_PaymentTransactions_Orders_OrderId",
                    column: x => x.OrderId,
                    principalTable: "Orders",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "ProductImages",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                ProductId = table.Column<Guid>(type: "TEXT", nullable: false),
                ImageUrl = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                AltText = table.Column<string>(type: "TEXT", maxLength: 250, nullable: true),
                IsPrimary = table.Column<bool>(type: "INTEGER", nullable: false),
                SortOrder = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ProductImages", x => x.Id);
                table.ForeignKey(
                    name: "FK_ProductImages_Products_ProductId",
                    column: x => x.ProductId,
                    principalTable: "Products",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Categories_Slug",
            table: "Categories",
            column: "Slug",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_CartItems_CartId_ProductId",
            table: "CartItems",
            columns: new[] { "CartId", "ProductId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_Carts_UserId",
            table: "Carts",
            column: "UserId",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_OrderItems_OrderId_ProductId",
            table: "OrderItems",
            columns: new[] { "OrderId", "ProductId" },
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_Orders_OrderNumber",
            table: "Orders",
            column: "OrderNumber",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_Orders_UserId",
            table: "Orders",
            column: "UserId");

        migrationBuilder.CreateIndex(
            name: "IX_PaymentTransactions_Authority",
            table: "PaymentTransactions",
            column: "Authority");

        migrationBuilder.CreateIndex(
            name: "IX_PaymentTransactions_OrderId",
            table: "PaymentTransactions",
            column: "OrderId",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_ProductImages_ProductId_SortOrder",
            table: "ProductImages",
            columns: new[] { "ProductId", "SortOrder" });

        migrationBuilder.CreateIndex(
            name: "IX_Products_CategoryId",
            table: "Products",
            column: "CategoryId");

        migrationBuilder.CreateIndex(
            name: "IX_Products_Slug",
            table: "Products",
            column: "Slug",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_Products_Status",
            table: "Products",
            column: "Status");

        migrationBuilder.CreateIndex(
            name: "IX_UserAccounts_Email",
            table: "UserAccounts",
            column: "Email",
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "CartItems");
        migrationBuilder.DropTable(name: "OrderItems");
        migrationBuilder.DropTable(name: "PaymentTransactions");
        migrationBuilder.DropTable(name: "ProductImages");
        migrationBuilder.DropTable(name: "UserAccounts");
        migrationBuilder.DropTable(name: "Carts");
        migrationBuilder.DropTable(name: "Orders");
        migrationBuilder.DropTable(name: "Products");
        migrationBuilder.DropTable(name: "Categories");
    }
}
