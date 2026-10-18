using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDollarProductPricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "PriceExchangeRate",
                table: "Products",
                type: "TEXT",
                precision: 18,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "UsdPrice",
                table: "Products",
                type: "TEXT",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PriceExchangeRate",
                table: "OrderItems",
                type: "TEXT",
                precision: 18,
                scale: 6,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "UsdUnitPrice",
                table: "OrderItems",
                type: "TEXT",
                precision: 18,
                scale: 4,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "UsdtExchangeRates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false),
                    TomanPerUsdt = table.Column<decimal>(type: "TEXT", precision: 18, scale: 6, nullable: true),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastAttemptAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                    NextRefreshAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Sources = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    LastError = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UsdtExchangeRates", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "UsdtExchangeRates",
                columns: new[] { "Id", "LastAttemptAtUtc", "LastError", "NextRefreshAtUtc", "Sources", "TomanPerUsdt", "UpdatedAtUtc" },
                values: new object[] { 1, null, null, new DateTime(1970, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "", null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UsdtExchangeRates");

            migrationBuilder.DropColumn(
                name: "PriceExchangeRate",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "UsdPrice",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "PriceExchangeRate",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "UsdUnitPrice",
                table: "OrderItems");
        }
    }
}
