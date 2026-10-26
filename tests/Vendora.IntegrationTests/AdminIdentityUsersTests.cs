using System.Net;
using System.Net.Http.Json;
using Application.Admin.DTOs;
using Domain.Entities;
using Domain.Enums;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Persistence;
using Persistence.Identity;
using Xunit;

namespace Vendora.IntegrationTests;

/// <summary>Regression coverage for users/admins displayed in the admin panel.</summary>
public sealed class AdminIdentityUsersTests
{
    [Fact]
    public async Task ListAndDetails_ReadAuthenticatedIdentityUsers_NotLegacyUserAccounts()
    {
        await using var host = await CreateHostAsync();
        Guid adminId;
        Guid customerId;
        using (var scope = host.App.Services.CreateScope())
        {
            var (admin, customer) = await SeedIdentityAsync(scope.ServiceProvider);
            adminId = admin.Id;
            customerId = customer.Id;
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.UserAccounts.Add(new UserAccount
            {
                FullName = "Legacy only",
                Email = "legacy@example.test",
                Role = UserRole.Admin
            });
            await db.SaveChangesAsync();
        }

        using var client = host.Client("Admin");
        var users = await client.GetFromJsonAsync<AdminUserDto[]>("/api/admin/users");
        Assert.NotNull(users);
        Assert.Equal(2, users.Length);
        Assert.Contains(users, row => row.Id == adminId &&
            row.Email == "admin@vendora.tofanservice.ir" && row.Role == UserRole.Admin);
        Assert.Contains(users, row => row.Id == customerId && row.Role == UserRole.Customer);
        Assert.DoesNotContain(users, row => row.Email == "legacy@example.test");

        var details = await client.GetFromJsonAsync<AdminUserDto>($"/api/admin/users/{adminId}");
        Assert.Equal(adminId, details!.Id);
        Assert.Equal(UserRole.Admin, details.Role);
    }

    [Fact]
    public async Task EditingUser_UpdatesIdentityProfileAndRealRole_WithoutTouchingLegacyTable()
    {
        await using var host = await CreateHostAsync();
        Guid customerId;
        string? previousStamp;
        using (var scope = host.App.Services.CreateScope())
        {
            var (_, customer) = await SeedIdentityAsync(scope.ServiceProvider);
            customerId = customer.Id;
            previousStamp = customer.SecurityStamp;
        }

        using var client = host.Client("Admin");
        using var response = await client.PutAsJsonAsync($"/api/admin/users/{customerId}", new
        {
            fullName = "Updated Name",
            email = "updated@example.test",
            phoneNumber = "+989121111111",
            role = "Admin"
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var scopeAfter = host.App.Services.CreateScope();
        var userManager = scopeAfter.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var db = scopeAfter.ServiceProvider.GetRequiredService<AppDbContext>();
        var identityUser = await userManager.FindByIdAsync(customerId.ToString());
        Assert.NotNull(identityUser);
        Assert.Equal("Updated Name", identityUser.FullName);
        Assert.Equal("updated@example.test", identityUser.Email);
        Assert.Equal("updated@example.test", identityUser.UserName);
        Assert.Equal("UPDATED@EXAMPLE.TEST", identityUser.NormalizedEmail);
        Assert.NotEqual(previousStamp, identityUser.SecurityStamp);
        Assert.True(await userManager.IsInRoleAsync(identityUser, "Admin"));
        Assert.False(await userManager.IsInRoleAsync(identityUser, "Customer"));
        Assert.True(await userManager.CheckPasswordAsync(identityUser, "Passw0rd!2026"));
        Assert.Empty(await db.UserAccounts.ToListAsync());

        var updated = await client.GetFromJsonAsync<AdminUserDto>($"/api/admin/users/{customerId}");
        Assert.Equal(UserRole.Admin, updated!.Role);
        Assert.Equal("updated@example.test", updated.Email);
    }

    [Fact]
    public async Task LastAdministratorCannotBeDemoted_AndInvalidRoleRejected()
    {
        await using var host = await CreateHostAsync();
        Guid adminId;
        using (var scope = host.App.Services.CreateScope())
        {
            var (admin, _) = await SeedIdentityAsync(scope.ServiceProvider);
            adminId = admin.Id;
        }

        using var client = host.Client("Admin");
        var input = new { fullName = "Admin", email = "admin@vendora.tofanservice.ir",
            phoneNumber = (string?)null, role = "Customer" };
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync($"/api/admin/users/{adminId}", input)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync($"/api/admin/users/{adminId}", new {
                fullName = "Admin", email = "admin@vendora.tofanservice.ir",
                phoneNumber = (string?)null, role = "999" })).StatusCode);
        var details = await client.GetFromJsonAsync<AdminUserDto>($"/api/admin/users/{adminId}");
        Assert.Equal(UserRole.Admin, details!.Role);
    }

    private static Task<ProductArticleTests.ArticleHost> CreateHostAsync() =>
        ProductArticleTests.ArticleHost.CreateAsync(services =>
        {
            services.AddIdentityCore<AppUser>()
                .AddRoles<IdentityRole<Guid>>()
                .AddEntityFrameworkStores<AppDbContext>();
        });

    private static async Task<(AppUser admin, AppUser customer)> SeedIdentityAsync(IServiceProvider provider)
    {
        var roles = provider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        foreach (string role in new[] { "Admin", "Customer" })
            Assert.True((await roles.CreateAsync(new IdentityRole<Guid>(role))).Succeeded);

        var users = provider.GetRequiredService<UserManager<AppUser>>();
        var admin = new AppUser { FullName = "Admin", Email = "admin@vendora.tofanservice.ir",
            UserName = "admin@vendora.tofanservice.ir" };
        var customer = new AppUser { FullName = "Customer", Email = "customer@example.test",
            UserName = "customer@example.test" };
        foreach (var (user, role) in new[] { (admin, "Admin"), (customer, "Customer") })
        {
            var created = await users.CreateAsync(user, "Passw0rd!2026");
            Assert.True(created.Succeeded, string.Join(";", created.Errors.Select(x => x.Description)));
            var assigned = await users.AddToRoleAsync(user, role);
            Assert.True(assigned.Succeeded, string.Join(";", assigned.Errors.Select(x => x.Description)));
        }
        return (admin, customer);
    }
}
