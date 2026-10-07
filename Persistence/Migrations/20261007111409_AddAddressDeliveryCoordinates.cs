using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAddressDeliveryCoordinates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "ShippingLatitude",
                table: "Orders",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "ShippingLongitude",
                table: "Orders",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "CustomerAddresses",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "CustomerAddresses",
                type: "REAL",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ShippingLatitude",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ShippingLongitude",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "CustomerAddresses");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "CustomerAddresses");
        }
    }
}
