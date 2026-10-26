using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddShippingPolicyQuotesAndPriceSnapshots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "WeightGrams",
                table: "Products",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShippingPolicySnapshotJson",
                table: "Orders",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "BaseUnitPrice",
                table: "OrderItems",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DiscountSnapshot",
                table: "OrderItems",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "EmbeddedShippingUnitAmount",
                table: "OrderItems",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "BaseUnitPrice",
                table: "FinancialDocumentLines",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "EmbeddedShippingUnitAmount",
                table: "FinancialDocumentLines",
                type: "TEXT",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "ShippingPolicies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    IncludedInPrice = table.Column<bool>(type: "INTEGER", nullable: false),
                    UnitAmount = table.Column<decimal>(type: "TEXT", precision: 18, scale: 0, nullable: false),
                    Version = table.Column<long>(type: "INTEGER", nullable: false),
                    OriginCityCode = table.Column<string>(type: "TEXT", nullable: false),
                    OriginLatitude = table.Column<double>(type: "REAL", nullable: true),
                    OriginLongitude = table.Column<double>(type: "REAL", nullable: true),
                    CourierCode = table.Column<string>(type: "TEXT", nullable: false),
                    ServiceType = table.Column<string>(type: "TEXT", nullable: false),
                    PaymentType = table.Column<string>(type: "TEXT", nullable: false),
                    CollectionType = table.Column<string>(type: "TEXT", nullable: false),
                    PackagesJson = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShippingPolicies", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ShippingQuotes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    UserId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AddressId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Fingerprint = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    DestinationCityCode = table.Column<string>(type: "TEXT", nullable: false),
                    PolicyVersion = table.Column<long>(type: "INTEGER", nullable: false),
                    CostToman = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: false),
                    ExpiresAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShippingQuotes", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ShippingQuotes_UserId_Fingerprint_ExpiresAtUtc",
                table: "ShippingQuotes",
                columns: new[] { "UserId", "Fingerprint", "ExpiresAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ShippingPolicies");

            migrationBuilder.DropTable(
                name: "ShippingQuotes");

            migrationBuilder.DropColumn(
                name: "WeightGrams",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ShippingPolicySnapshotJson",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BaseUnitPrice",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "DiscountSnapshot",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "EmbeddedShippingUnitAmount",
                table: "OrderItems");

            migrationBuilder.DropColumn(
                name: "BaseUnitPrice",
                table: "FinancialDocumentLines");

            migrationBuilder.DropColumn(
                name: "EmbeddedShippingUnitAmount",
                table: "FinancialDocumentLines");
        }
    }
}
