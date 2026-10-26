using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Persistence;

public partial class AppDbContext
{
    public DbSet<ShippingPolicy> ShippingPolicies => Set<ShippingPolicy>();
    public DbSet<ShippingQuote> ShippingQuotes => Set<ShippingQuote>();

    /// <summary>Maps additive shipping data and optimistic policy concurrency without changing historical amounts.</summary>
    private static void ConfigureShipping(ModelBuilder model)
    {
        model.Entity<ShippingPolicy>().HasKey(x => x.Id);
        model.Entity<ShippingPolicy>().Property(x => x.Version).IsConcurrencyToken();
        model.Entity<ShippingPolicy>().Property(x => x.UnitAmount).HasPrecision(18, 0);
        model.Entity<ShippingQuote>().HasKey(x => x.Id);
        model.Entity<ShippingQuote>().HasIndex(x => new { x.UserId, x.Fingerprint, x.ExpiresAtUtc });
        model.Entity<ShippingQuote>().Property(x => x.Fingerprint).HasMaxLength(64);
        model.Entity<ShippingQuote>().Property(x => x.CostToman).HasPrecision(18, 2);
    }
}
