using Domain.Common;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Persistence.Common;

namespace Persistence;

/// <summary>
/// Primary EF Core context for Vendora.
/// </summary>
public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options), IUnitOfWork
{
    /// <summary>Gets the product categories.</summary>
    public DbSet<Category> Categories => Set<Category>();

    /// <summary>Gets the products.</summary>
    public DbSet<Product> Products => Set<Product>();

    /// <summary>Gets the product images.</summary>
    public DbSet<ProductImage> ProductImages => Set<ProductImage>();

    /// <summary>Gets the shopping carts.</summary>
    public DbSet<Cart> Carts => Set<Cart>();

    /// <summary>Gets the cart items.</summary>
    public DbSet<CartItem> CartItems => Set<CartItem>();

    /// <summary>Gets the orders.</summary>
    public DbSet<Order> Orders => Set<Order>();

    /// <summary>Gets the order items.</summary>
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    /// <summary>Gets the payment transactions.</summary>
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();

    /// <summary>Gets the user accounts.</summary>
    public DbSet<UserAccount> UserAccounts => Set<UserAccount>();

    /// <summary>
    /// Configures entity mappings, relationships, indexes, and UTC date handling.
    /// </summary>
    /// <param name="modelBuilder">The EF model builder.</param>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Category>(builder =>
        {
            builder.ToTable("Categories");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Name).HasMaxLength(150).IsRequired();
            builder.Property(x => x.Slug).HasMaxLength(180).IsRequired();
            builder.Property(x => x.IsActive).HasDefaultValue(true);
            builder.HasIndex(x => x.Slug).IsUnique();
        });

        modelBuilder.Entity<Product>(builder =>
        {
            builder.ToTable("Products");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Title).HasMaxLength(250).IsRequired();
            builder.Property(x => x.Slug).HasMaxLength(280).IsRequired();
            builder.Property(x => x.Description).HasMaxLength(4000);
            builder.Property(x => x.Price).HasPrecision(18, 2);
            builder.Property(x => x.Status).HasConversion<int>();
            builder.Property(x => x.InventoryStatus).HasConversion<int>();
            builder.HasIndex(x => x.Slug).IsUnique();
            builder.HasIndex(x => x.Status);
            builder.HasOne(x => x.Category)
                .WithMany(x => x.Products)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<ProductImage>(builder =>
        {
            builder.ToTable("ProductImages");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.ImageUrl).HasMaxLength(500).IsRequired();
            builder.Property(x => x.AltText).HasMaxLength(250);
            builder.Property(x => x.SortOrder).HasDefaultValue(0);
            builder.HasIndex(x => new { x.ProductId, x.SortOrder });
            builder.HasOne(x => x.Product)
                .WithMany(x => x.Images)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Cart>(builder =>
        {
            builder.ToTable("Carts");
            builder.HasKey(x => x.Id);
            builder.HasIndex(x => x.UserId).IsUnique();
        });

        modelBuilder.Entity<CartItem>(builder =>
        {
            builder.ToTable("CartItems");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.ProductTitle).HasMaxLength(250).IsRequired();
            builder.Property(x => x.UnitPrice).HasPrecision(18, 2);
            builder.HasIndex(x => new { x.CartId, x.ProductId }).IsUnique();
            builder.HasOne(x => x.Cart)
                .WithMany(x => x.Items)
                .HasForeignKey(x => x.CartId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Order>(builder =>
        {
            builder.ToTable("Orders");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.OrderNumber).HasMaxLength(50).IsRequired();
            builder.Property(x => x.CurrencyCode).HasMaxLength(3).IsRequired();
            builder.Property(x => x.Subtotal).HasPrecision(18, 2);
            builder.Property(x => x.ShippingCost).HasPrecision(18, 2);
            builder.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            builder.Property(x => x.TotalAmount).HasPrecision(18, 2);
            builder.Property(x => x.Status).HasConversion<int>();
            builder.Property(x => x.PaymentStatus).HasConversion<int>();
            builder.HasIndex(x => x.OrderNumber).IsUnique();
            builder.HasIndex(x => x.UserId);
        });

        modelBuilder.Entity<OrderItem>(builder =>
        {
            builder.ToTable("OrderItems");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.ProductTitle).HasMaxLength(250).IsRequired();
            builder.Property(x => x.UnitPrice).HasPrecision(18, 2);
            builder.HasIndex(x => new { x.OrderId, x.ProductId }).IsUnique();
            builder.HasOne(x => x.Order)
                .WithMany(x => x.Items)
                .HasForeignKey(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PaymentTransaction>(builder =>
        {
            builder.ToTable("PaymentTransactions");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Provider).HasConversion<int>();
            builder.Property(x => x.Authority).HasMaxLength(100);
            builder.Property(x => x.ReferenceId).HasMaxLength(100);
            builder.Property(x => x.Amount).HasPrecision(18, 2);
            builder.Property(x => x.Status).HasConversion<int>();
            builder.Property(x => x.FailureReason).HasMaxLength(500);
            builder.HasIndex(x => x.OrderId).IsUnique();
            builder.HasIndex(x => x.Authority);
            builder.HasOne(x => x.Order)
                .WithOne()
                .HasForeignKey<PaymentTransaction>(x => x.OrderId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserAccount>(builder =>
        {
            builder.ToTable("UserAccounts");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.FullName).HasMaxLength(200).IsRequired();
            builder.Property(x => x.Email).HasMaxLength(320).IsRequired();
            builder.Property(x => x.PhoneNumber).HasMaxLength(20);
            builder.Property(x => x.Role).HasConversion<int>();
            builder.HasIndex(x => x.Email).IsUnique();
        });

        var utcDateTimeConverter = new ValueConverter<DateTime, DateTime>(
            value => value.Kind == DateTimeKind.Utc ? value : value.ToUniversalTime(),
            value => DateTime.SpecifyKind(value, DateTimeKind.Utc));

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime))
                {
                    property.SetValueConverter(utcDateTimeConverter);
                }
            }
        }
    }

    /// <summary>
    /// Applies audit timestamps before saving changes.
    /// </summary>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The number of affected rows.</returns>
    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        ApplyAuditTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Applies audit timestamps before saving changes.
    /// </summary>
    /// <returns>The number of affected rows.</returns>
    public override int SaveChanges()
    {
        ApplyAuditTimestamps();
        return base.SaveChanges();
    }

    private void ApplyAuditTimestamps()
    {
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedAtUtc = now;
                entry.Entity.UpdatedAtUtc = null;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.UpdatedAtUtc = now;
            }
        }
    }
}
