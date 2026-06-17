using System;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Persistence.Migrations;

/// <summary>
/// Tracks the current EF Core model for future migrations.
/// </summary>
[DbContext(typeof(AppDbContext))]
partial class AppDbContextModelSnapshot : ModelSnapshot
{
    /// <inheritdoc />
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
#pragma warning disable 612, 618
        modelBuilder.HasAnnotation("ProductVersion", "10.0.8");

        modelBuilder.Entity("Domain.Entities.Cart", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("TEXT");

            b.Property<DateTime>("CreatedAtUtc")
                .HasColumnType("TEXT");

            b.Property<DateTime?>("UpdatedAtUtc")
                .HasColumnType("TEXT");

            b.Property<Guid?>("UserId")
                .HasColumnType("TEXT");

            b.HasKey("Id");

            b.HasIndex("UserId")
                .IsUnique();

            b.ToTable("Carts");
        });

        modelBuilder.Entity("Domain.Entities.CartItem", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("TEXT");

            b.Property<Guid>("CartId")
                .HasColumnType("TEXT");

            b.Property<Guid>("ProductId")
                .HasColumnType("TEXT");

            b.Property<string>("ProductTitle")
                .IsRequired()
                .HasMaxLength(250)
                .HasColumnType("TEXT");

            b.Property<int>("Quantity")
                .HasColumnType("INTEGER");

            b.Property<decimal>("UnitPrice")
                .HasPrecision(18, 2)
                .HasColumnType("TEXT");

            b.HasKey("Id");

            b.HasIndex("CartId", "ProductId")
                .IsUnique();

            b.ToTable("CartItems");
        });

        modelBuilder.Entity("Domain.Entities.Category", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("TEXT");

            b.Property<DateTime>("CreatedAtUtc")
                .HasColumnType("TEXT");

            b.Property<bool>("IsActive")
                .ValueGeneratedOnAdd()
                .HasColumnType("INTEGER")
                .HasDefaultValue(true);

            b.Property<string>("Name")
                .IsRequired()
                .HasMaxLength(150)
                .HasColumnType("TEXT");

            b.Property<string>("Slug")
                .IsRequired()
                .HasMaxLength(180)
                .HasColumnType("TEXT");

            b.Property<DateTime?>("UpdatedAtUtc")
                .HasColumnType("TEXT");

            b.HasKey("Id");

            b.HasIndex("Slug")
                .IsUnique();

            b.ToTable("Categories");
        });

        modelBuilder.Entity("Domain.Entities.Order", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("TEXT");

            b.Property<DateTime>("CreatedAtUtc")
                .HasColumnType("TEXT");

            b.Property<string>("CurrencyCode")
                .IsRequired()
                .HasMaxLength(3)
                .HasColumnType("TEXT");

            b.Property<decimal>("DiscountAmount")
                .HasPrecision(18, 2)
                .HasColumnType("TEXT");

            b.Property<string>("OrderNumber")
                .IsRequired()
                .HasMaxLength(50)
                .HasColumnType("TEXT");

            b.Property<int>("PaymentStatus")
                .HasColumnType("INTEGER");

            b.Property<decimal>("ShippingCost")
                .HasPrecision(18, 2)
                .HasColumnType("TEXT");

            b.Property<int>("Status")
                .HasColumnType("INTEGER");

            b.Property<decimal>("Subtotal")
                .HasPrecision(18, 2)
                .HasColumnType("TEXT");

            b.Property<decimal>("TotalAmount")
                .HasPrecision(18, 2)
                .HasColumnType("TEXT");

            b.Property<DateTime?>("UpdatedAtUtc")
                .HasColumnType("TEXT");

            b.Property<Guid?>("UserId")
                .HasColumnType("TEXT");

            b.HasKey("Id");

            b.HasIndex("OrderNumber")
                .IsUnique();

            b.HasIndex("UserId");

            b.ToTable("Orders");
        });

        modelBuilder.Entity("Domain.Entities.OrderItem", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("TEXT");

            b.Property<Guid>("OrderId")
                .HasColumnType("TEXT");

            b.Property<Guid>("ProductId")
                .HasColumnType("TEXT");

            b.Property<string>("ProductTitle")
                .IsRequired()
                .HasMaxLength(250)
                .HasColumnType("TEXT");

            b.Property<int>("Quantity")
                .HasColumnType("INTEGER");

            b.Property<decimal>("UnitPrice")
                .HasPrecision(18, 2)
                .HasColumnType("TEXT");

            b.HasKey("Id");

            b.HasIndex("OrderId", "ProductId")
                .IsUnique();

            b.ToTable("OrderItems");
        });

        modelBuilder.Entity("Domain.Entities.PaymentTransaction", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("TEXT");

            b.Property<decimal>("Amount")
                .HasPrecision(18, 2)
                .HasColumnType("TEXT");

            b.Property<string>("Authority")
                .HasMaxLength(100)
                .HasColumnType("TEXT");

            b.Property<DateTime>("CreatedAtUtc")
                .HasColumnType("TEXT");

            b.Property<string>("FailureReason")
                .HasMaxLength(500)
                .HasColumnType("TEXT");

            b.Property<Guid>("OrderId")
                .HasColumnType("TEXT");

            b.Property<int>("Provider")
                .HasColumnType("INTEGER");

            b.Property<string>("ReferenceId")
                .HasMaxLength(100)
                .HasColumnType("TEXT");

            b.Property<int>("Status")
                .HasColumnType("INTEGER");

            b.Property<DateTime?>("UpdatedAtUtc")
                .HasColumnType("TEXT");

            b.HasKey("Id");

            b.HasIndex("Authority");

            b.HasIndex("OrderId")
                .IsUnique();

            b.ToTable("PaymentTransactions");
        });

        modelBuilder.Entity("Domain.Entities.Product", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("TEXT");

            b.Property<Guid?>("CategoryId")
                .HasColumnType("TEXT");

            b.Property<DateTime>("CreatedAtUtc")
                .HasColumnType("TEXT");

            b.Property<string>("Description")
                .HasMaxLength(4000)
                .HasColumnType("TEXT");

            b.Property<int>("InventoryStatus")
                .HasColumnType("INTEGER");

            b.Property<decimal>("Price")
                .HasPrecision(18, 2)
                .HasColumnType("TEXT");

            b.Property<string>("Slug")
                .IsRequired()
                .HasMaxLength(280)
                .HasColumnType("TEXT");

            b.Property<int>("Status")
                .HasColumnType("INTEGER");

            b.Property<int>("StockQuantity")
                .HasColumnType("INTEGER");

            b.Property<string>("Title")
                .IsRequired()
                .HasMaxLength(250)
                .HasColumnType("TEXT");

            b.Property<DateTime?>("UpdatedAtUtc")
                .HasColumnType("TEXT");

            b.HasKey("Id");

            b.HasIndex("CategoryId");

            b.HasIndex("Slug")
                .IsUnique();

            b.HasIndex("Status");

            b.ToTable("Products");
        });

        modelBuilder.Entity("Domain.Entities.ProductImage", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("TEXT");

            b.Property<string>("AltText")
                .HasMaxLength(250)
                .HasColumnType("TEXT");

            b.Property<DateTime>("CreatedAtUtc")
                .HasColumnType("TEXT");

            b.Property<string>("ImageUrl")
                .IsRequired()
                .HasMaxLength(500)
                .HasColumnType("TEXT");

            b.Property<bool>("IsPrimary")
                .HasColumnType("INTEGER");

            b.Property<Guid>("ProductId")
                .HasColumnType("TEXT");

            b.Property<int>("SortOrder")
                .ValueGeneratedOnAdd()
                .HasColumnType("INTEGER")
                .HasDefaultValue(0);

            b.Property<DateTime?>("UpdatedAtUtc")
                .HasColumnType("TEXT");

            b.HasKey("Id");

            b.HasIndex("ProductId", "SortOrder");

            b.ToTable("ProductImages");
        });

        modelBuilder.Entity("Domain.Entities.UserAccount", b =>
        {
            b.Property<Guid>("Id")
                .ValueGeneratedOnAdd()
                .HasColumnType("TEXT");

            b.Property<DateTime>("CreatedAtUtc")
                .HasColumnType("TEXT");

            b.Property<string>("Email")
                .IsRequired()
                .HasMaxLength(320)
                .HasColumnType("TEXT");

            b.Property<string>("FullName")
                .IsRequired()
                .HasMaxLength(200)
                .HasColumnType("TEXT");

            b.Property<string>("PhoneNumber")
                .HasMaxLength(20)
                .HasColumnType("TEXT");

            b.Property<int>("Role")
                .HasColumnType("INTEGER");

            b.Property<DateTime?>("UpdatedAtUtc")
                .HasColumnType("TEXT");

            b.HasKey("Id");

            b.HasIndex("Email")
                .IsUnique();

            b.ToTable("UserAccounts");
        });

        modelBuilder.Entity("Domain.Entities.CartItem", b =>
        {
            b.HasOne("Domain.Entities.Cart", "Cart")
                .WithMany("Items")
                .HasForeignKey("CartId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.Navigation("Cart");
        });

        modelBuilder.Entity("Domain.Entities.OrderItem", b =>
        {
            b.HasOne("Domain.Entities.Order", "Order")
                .WithMany("Items")
                .HasForeignKey("OrderId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.Navigation("Order");
        });

        modelBuilder.Entity("Domain.Entities.PaymentTransaction", b =>
        {
            b.HasOne("Domain.Entities.Order", "Order")
                .WithOne()
                .HasForeignKey("Domain.Entities.PaymentTransaction", "OrderId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.Navigation("Order");
        });

        modelBuilder.Entity("Domain.Entities.Product", b =>
        {
            b.HasOne("Domain.Entities.Category", "Category")
                .WithMany("Products")
                .HasForeignKey("CategoryId")
                .OnDelete(DeleteBehavior.SetNull);

            b.Navigation("Category");
        });

        modelBuilder.Entity("Domain.Entities.ProductImage", b =>
        {
            b.HasOne("Domain.Entities.Product", "Product")
                .WithMany("Images")
                .HasForeignKey("ProductId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.Navigation("Product");
        });

        modelBuilder.Entity("Domain.Entities.Cart", b =>
        {
            b.Navigation("Items");
        });

        modelBuilder.Entity("Domain.Entities.Category", b =>
        {
            b.Navigation("Products");
        });

        modelBuilder.Entity("Domain.Entities.Order", b =>
        {
            b.Navigation("Items");
        });

        modelBuilder.Entity("Domain.Entities.Product", b =>
        {
            b.Navigation("Images");
        });
#pragma warning restore 612, 618
    }
}
