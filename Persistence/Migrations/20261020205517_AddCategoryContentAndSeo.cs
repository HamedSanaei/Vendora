using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCategoryContentAndSeo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Seo_AnalysisVersion",
                table: "Products",
                type: "TEXT",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_CanonicalUrl",
                table: "Products",
                type: "TEXT",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_Description",
                table: "Products",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_FocusKeyphrase",
                table: "Products",
                type: "TEXT",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Seo_Follow",
                table: "Products",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Seo_Index",
                table: "Products",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_RelatedKeyphrases",
                table: "Products",
                type: "TEXT",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Seo_Score",
                table: "Products",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_SocialDescription",
                table: "Products",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_SocialImageUrl",
                table: "Products",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_SocialTitle",
                table: "Products",
                type: "TEXT",
                maxLength: 250,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_Title",
                table: "Products",
                type: "TEXT",
                maxLength: 250,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Categories",
                type: "TEXT",
                maxLength: 200000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImageUrl",
                table: "Categories",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_AnalysisVersion",
                table: "Categories",
                type: "TEXT",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_CanonicalUrl",
                table: "Categories",
                type: "TEXT",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_Description",
                table: "Categories",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_FocusKeyphrase",
                table: "Categories",
                type: "TEXT",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Seo_Follow",
                table: "Categories",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Seo_Index",
                table: "Categories",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_RelatedKeyphrases",
                table: "Categories",
                type: "TEXT",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Seo_Score",
                table: "Categories",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_SocialDescription",
                table: "Categories",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_SocialImageUrl",
                table: "Categories",
                type: "TEXT",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_SocialTitle",
                table: "Categories",
                type: "TEXT",
                maxLength: 250,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Seo_Title",
                table: "Categories",
                type: "TEXT",
                maxLength: 250,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SeoRedirects",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    SourcePath = table.Column<string>(type: "TEXT", maxLength: 600, nullable: false),
                    TargetPath = table.Column<string>(type: "TEXT", maxLength: 600, nullable: false),
                    StatusCode = table.Column<int>(type: "INTEGER", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeoRedirects", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SeoSettings",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    SiteName = table.Column<string>(type: "TEXT", maxLength: 150, nullable: false),
                    SiteUrl = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    LogoUrl = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    TitleTemplate = table.Column<string>(type: "TEXT", maxLength: 250, nullable: false),
                    DefaultDescription = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    SocialProfiles = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    IsIndexingEnabled = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SeoSettings", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SlugHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Kind = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    EntityId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Slug = table.Column<string>(type: "TEXT", maxLength: 280, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SlugHistories", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "SeoSettings",
                columns: new[] { "Id", "DefaultDescription", "IsIndexingEnabled", "LogoUrl", "SiteName", "SiteUrl", "SocialProfiles", "TitleTemplate" },
                values: new object[] { new Guid("00000000-0000-0000-0000-000000000002"), null, false, null, "وندورا", "", null, "{title} | {siteName}" });

            migrationBuilder.CreateIndex(
                name: "IX_SeoRedirects_SourcePath",
                table: "SeoRedirects",
                column: "SourcePath",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SlugHistories_Kind_EntityId",
                table: "SlugHistories",
                columns: new[] { "Kind", "EntityId" });

            migrationBuilder.CreateIndex(
                name: "IX_SlugHistories_Kind_Slug",
                table: "SlugHistories",
                columns: new[] { "Kind", "Slug" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SeoRedirects");

            migrationBuilder.DropTable(
                name: "SeoSettings");

            migrationBuilder.DropTable(
                name: "SlugHistories");

            migrationBuilder.DropColumn(
                name: "Seo_AnalysisVersion",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Seo_CanonicalUrl",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Seo_Description",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Seo_FocusKeyphrase",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Seo_Follow",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Seo_Index",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Seo_RelatedKeyphrases",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Seo_Score",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Seo_SocialDescription",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Seo_SocialImageUrl",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Seo_SocialTitle",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Seo_Title",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Seo_AnalysisVersion",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Seo_CanonicalUrl",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Seo_Description",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Seo_FocusKeyphrase",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Seo_Follow",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Seo_Index",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Seo_RelatedKeyphrases",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Seo_Score",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Seo_SocialDescription",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Seo_SocialImageUrl",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Seo_SocialTitle",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "Seo_Title",
                table: "Categories");
        }
    }
}
