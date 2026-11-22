using Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Persistence;

public partial class AppDbContext
{
    public DbSet<EgressProxy> EgressProxies => Set<EgressProxy>();
    public DbSet<EgressRoute> EgressRoutes => Set<EgressRoute>();
    public DbSet<EgressCheck> EgressChecks => Set<EgressCheck>();
    public DbSet<EgressAudit> EgressAudits => Set<EgressAudit>();

    /// <summary>Disallows removing an assigned profile and detects concurrent settings edits.</summary>
    private static void ConfigureEgress(ModelBuilder model)
    {
        model.Entity<EgressProxy>().Property(x => x.Version).IsConcurrencyToken();
        model.Entity<EgressRoute>(b =>
        {
            b.HasKey(x => x.Service);
            b.Property(x => x.Version).IsConcurrencyToken();
            b.HasOne(x => x.Proxy).WithMany().HasForeignKey(x => x.ProxyId).OnDelete(DeleteBehavior.Restrict);
        });
    }
}
