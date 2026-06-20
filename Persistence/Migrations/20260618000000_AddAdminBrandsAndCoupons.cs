using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations;

/// <summary>
/// Adds admin-managed brands and coupons.
/// </summary>
[DbContext(typeof(AppDbContext))]
[Migration("20260618000000_AddAdminBrandsAndCoupons")]
public partial class AddAdminBrandsAndCoupons : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Brands",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                Name = table.Column<string>(type: "TEXT", maxLength: 150, nullable: false),
                Slug = table.Column<string>(type: "TEXT", maxLength: 180, nullable: false),
                LogoUrl = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                Email = table.Column<string>(type: "TEXT", maxLength: 320, nullable: true),
                Website = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                Description = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                Location = table.Column<string>(type: "TEXT", maxLength: 250, nullable: true),
                IsActive = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Brands", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "Coupons",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                CreatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAtUtc = table.Column<DateTime>(type: "TEXT", nullable: true),
                Title = table.Column<string>(type: "TEXT", maxLength: 150, nullable: false),
                Code = table.Column<string>(type: "TEXT", maxLength: 80, nullable: false),
                DiscountPercent = table.Column<decimal>(type: "TEXT", precision: 5, scale: 2, nullable: false),
                MaxDiscountAmount = table.Column<decimal>(type: "TEXT", precision: 18, scale: 2, nullable: true),
                ExpiresAtUtc = table.Column<DateTime>(type: "TEXT", nullable: false),
                IsActive = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                AppliesToAllCategories = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Coupons", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "CouponCategories",
            columns: table => new
            {
                CouponId = table.Column<Guid>(type: "TEXT", nullable: false),
                CategoryId = table.Column<Guid>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_CouponCategories", x => new { x.CouponId, x.CategoryId });
                table.ForeignKey(
                    name: "FK_CouponCategories_Categories_CategoryId",
                    column: x => x.CategoryId,
                    principalTable: "Categories",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_CouponCategories_Coupons_CouponId",
                    column: x => x.CouponId,
                    principalTable: "Coupons",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Brands_IsActive",
            table: "Brands",
            column: "IsActive");

        migrationBuilder.CreateIndex(
            name: "IX_Brands_Slug",
            table: "Brands",
            column: "Slug",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_CouponCategories_CategoryId",
            table: "CouponCategories",
            column: "CategoryId");

        migrationBuilder.CreateIndex(
            name: "IX_Coupons_Code",
            table: "Coupons",
            column: "Code",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_Coupons_ExpiresAtUtc",
            table: "Coupons",
            column: "ExpiresAtUtc");

        migrationBuilder.CreateIndex(
            name: "IX_Coupons_IsActive",
            table: "Coupons",
            column: "IsActive");
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "Brands");
        migrationBuilder.DropTable(name: "CouponCategories");
        migrationBuilder.DropTable(name: "Coupons");
    }
}
