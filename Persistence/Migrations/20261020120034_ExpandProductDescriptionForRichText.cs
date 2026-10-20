using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ExpandProductDescriptionForRichText : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // SQLite already stores descriptions as unrestricted TEXT. Only the EF model's
            // maximum length changes; rebuilding the table would be unnecessary and risk data.
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // The previous model annotation is restored without truncating any existing article.
        }
    }
}
