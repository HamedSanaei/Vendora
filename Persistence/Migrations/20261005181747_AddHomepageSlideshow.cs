using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddHomepageSlideshow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SlideshowSlides",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ImageUrl = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    DurationSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlideshowSlides", x => x.Id);
                    table.CheckConstraint("CK_SlideshowSlides_DurationSeconds", "DurationSeconds >= 1 AND DurationSeconds <= 120");
                    table.CheckConstraint("CK_SlideshowSlides_SortOrder", "SortOrder >= 0");
                });

            migrationBuilder.CreateIndex(
                name: "IX_SlideshowSlides_SortOrder_Id",
                table: "SlideshowSlides",
                columns: new[] { "SortOrder", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SlideshowSlides");
        }
    }
}
