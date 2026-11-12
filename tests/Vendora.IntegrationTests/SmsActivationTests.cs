using Domain.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Runs the actual additive activation migration only against isolated in-memory databases.</summary>
public sealed class SmsActivationTests
{
    /// <summary>Only an enabled ParsGreen policy is upgraded; notification settings and explicit master-off policies survive.</summary>
    [Theory]
    [InlineData("ParsGreen", true, true)]
    [InlineData("ParsGreen", false, false)]
    [InlineData("Kavenegar", true, false)]
    public async Task Migration_ActivatesApprovedPhoneLoginOnce_WithoutEnablingNotifications(string provider, bool enabled, bool activated)
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.GetService<IMigrator>().MigrateAsync("20261029191541_AddParsGreenBrandedOtpMode");
        const string rules = "[]", recipients = "[]";
        db.SmsSettings.Add(new SmsSettings { Version = 7, Enabled = enabled, Provider = provider, PhoneLogin = false,
            ParsGreenBrandedOtp = false, PasswordRecovery = false, RulesJson = rules, RecipientsJson = recipients, LowStockThreshold = 9 });
        await db.SaveChangesAsync();
        await db.Database.MigrateAsync();
        db.ChangeTracker.Clear();
        var policy = await db.SmsSettings.SingleAsync();
        Assert.Equal(enabled, policy.Enabled);
        Assert.Equal(provider, policy.Provider);
        Assert.Equal(activated, policy.PhoneLogin);
        Assert.Equal(activated, policy.ParsGreenBrandedOtp);
        Assert.Equal(activated ? 8 : 7, policy.Version);
        Assert.False(policy.PasswordRecovery);
        Assert.Equal(rules, policy.RulesJson);
        Assert.Equal(recipients, policy.RecipientsJson);
        Assert.Equal(9, policy.LowStockThreshold);
        await db.Database.MigrateAsync();
        db.ChangeTracker.Clear();
        Assert.Equal(activated ? 8 : 7, (await db.SmsSettings.SingleAsync()).Version);
    }
}
