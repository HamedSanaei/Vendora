using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EnableApprovedParsGreenPhoneLogin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // The store owner approved the registered texts and customer phone authentication (issue #5).
            // Conditional data-only activation preserves master-off policies, other providers, notification
            // rules, recipients and credentials; the version invalidates already-open settings forms.
            migrationBuilder.Sql("""
                UPDATE "SmsSettings"
                SET "PhoneLogin" = 1, "ParsGreenBrandedOtp" = 1, "Version" = "Version" + 1
                WHERE "Id" = 1 AND "Provider" = 'ParsGreen' AND "Enabled" = 1
                  AND ("PhoneLogin" = 0 OR "ParsGreenBrandedOtp" = 0);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Configuration is not rolled back: the former flags cannot be inferred and may since have
            // been edited by an administrator. No schema or business data was added or removed.
        }
    }
}
