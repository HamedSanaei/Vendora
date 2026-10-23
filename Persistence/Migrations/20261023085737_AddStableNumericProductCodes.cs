using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddStableNumericProductCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProductCode",
                table: "Products",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ProductCodeSequences",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false),
                    NextValue = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductCodeSequences", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "ProductCodeSequences",
                columns: new[] { "Id", "NextValue" },
                values: new object[] { 1, 100 });

            // One-time SQLite data backfill: preserve all IDs/slugs and number every legacy
            // product (including drafts/archived rows) deterministically before adding uniqueness.
            migrationBuilder.Sql("""
                WITH Numbered AS (
                    SELECT "Id", 99 + ROW_NUMBER() OVER (ORDER BY "CreatedAtUtc", "Id") AS Code
                    FROM "Products"
                )
                UPDATE "Products"
                SET "ProductCode" = (SELECT Code FROM Numbered WHERE Numbered."Id" = "Products"."Id");
                UPDATE "ProductCodeSequences"
                SET "NextValue" = (SELECT COALESCE(MAX("ProductCode"), 99) + 1 FROM "Products")
                WHERE "Id" = 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Products_ProductCode",
                table: "Products",
                column: "ProductCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProductCodeSequences");

            migrationBuilder.DropIndex(
                name: "IX_Products_ProductCode",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ProductCode",
                table: "Products");
        }
    }
}
