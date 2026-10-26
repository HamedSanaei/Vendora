using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Persistence.Identity;

namespace Persistence;

public partial class AppDbContext
{
    public DbSet<SmsSettings> SmsSettings => Set<SmsSettings>();
    public DbSet<VerifiedPhoneIdentity> VerifiedPhoneIdentities => Set<VerifiedPhoneIdentity>();
    public DbSet<SmsPhoneBudget> SmsPhoneBudgets => Set<SmsPhoneBudget>();
    public DbSet<SmsChallenge> SmsChallenges => Set<SmsChallenge>();
    public DbSet<SmsMessage> SmsMessages => Set<SmsMessage>();
    public DbSet<SmsStockWatch> SmsStockWatches => Set<SmsStockWatch>();
    public DbSet<SupportTicket> SupportTickets => Set<SupportTicket>();
    public DbSet<SupportTicketMessage> SupportTicketMessages => Set<SupportTicketMessage>();

    /// <summary>Maps additive messaging and support records, with database-enforced ownership/idempotency/concurrency.</summary>
    private static void ConfigureSms(ModelBuilder model)
    {
        model.Entity<SmsSettings>(b => { b.HasKey(x => x.Id); b.Property(x => x.Version).IsConcurrencyToken(); });
        model.Entity<VerifiedPhoneIdentity>(b => { b.HasKey(x => x.UserId); b.HasIndex(x => x.Phone).IsUnique(); b.Property(x => x.Phone).HasMaxLength(20); b.HasOne<AppUser>().WithOne().HasForeignKey<VerifiedPhoneIdentity>(x => x.UserId).OnDelete(DeleteBehavior.Restrict); });
        model.Entity<SmsPhoneBudget>(b => { b.HasKey(x => x.Phone); b.Property(x => x.Phone).HasMaxLength(20); b.Property(x => x.Version).IsConcurrencyToken(); });
        model.Entity<SmsChallenge>(b => { b.HasKey(x => x.Id); b.Property(x => x.Version).IsConcurrencyToken(); b.HasIndex(x => new { x.Phone, x.Purpose, x.ExpiresAtUtc }); b.Property(x => x.CodeHash).HasMaxLength(500); b.Property(x => x.RecoveryHash).HasMaxLength(64); });
        model.Entity<SmsMessage>(b => { b.HasKey(x => x.Id); b.HasIndex(x => new { x.EventKey, x.Phone }).IsUnique(); b.HasIndex(x => new { x.Status, x.NextAttemptAtUtc }); b.Property(x => x.EventKey).HasMaxLength(200); b.Property(x => x.Phone).HasMaxLength(20); b.Property(x => x.Body).HasMaxLength(3000); b.Property(x => x.Version).IsConcurrencyToken(); });
        model.Entity<SmsStockWatch>().HasKey(x => x.ProductId);
        model.Entity<SupportTicket>(b => { b.HasKey(x => x.Id); b.Property(x => x.Version).IsConcurrencyToken(); b.Property(x => x.Subject).HasMaxLength(200); b.HasIndex(x => new { x.UserId, x.UpdatedAtUtc }); b.HasMany(x => x.Messages).WithOne().HasForeignKey(x => x.TicketId).OnDelete(DeleteBehavior.Restrict); });
        model.Entity<SupportTicketMessage>(b => { b.HasKey(x => x.Id); b.Property(x => x.Text).HasMaxLength(3000); b.HasIndex(x => new { x.TicketId, x.CreatedAtUtc }); });
    }
}
