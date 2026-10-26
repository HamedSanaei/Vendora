using Application.Admin.DTOs;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Persistence;
using Persistence.Identity;

namespace Application.Admin;

/// <summary>
/// User administration over the same Identity accounts used for login.
/// The legacy UserAccounts table is not an authentication source.
/// </summary>
public static class Users
{
    private const string AdminRole = "Admin";
    private const string CustomerRole = "Customer";

    // One database query for the list/detail endpoints, including the actual Identity role.
    private static IQueryable<AdminUserDto> IdentityUsers(AppDbContext db, IQueryable<AppUser> source) =>
        source.Select(user => new AdminUserDto(
            user.Id,
            user.FullName,
            user.Email ?? string.Empty,
            user.PhoneNumber,
            db.UserRoles.Any(membership => membership.UserId == user.Id &&
                db.Roles.Any(role => role.Id == membership.RoleId && role.NormalizedName == "ADMIN"))
                ? UserRole.Admin : UserRole.Customer));

    /// <summary>Lists real customer and administrator accounts.</summary>
    public static class List
    {
        public sealed record Query : IRequest<IReadOnlyList<AdminUserDto>>;

        public sealed class Handler(AppDbContext db) : IRequestHandler<Query, IReadOnlyList<AdminUserDto>>
        {
            public async Task<IReadOnlyList<AdminUserDto>> Handle(Query request, CancellationToken cancellationToken) =>
                await IdentityUsers(db, db.Users.AsNoTracking().OrderBy(user => user.FullName)).ToListAsync(cancellationToken);
        }
    }

    /// <summary>Returns a real Identity account.</summary>
    public static class Details
    {
        public sealed record Query(Guid Id) : IRequest<AdminUserDto?>;

        public sealed class Handler(AppDbContext db) : IRequestHandler<Query, AdminUserDto?>
        {
            public Task<AdminUserDto?> Handle(Query request, CancellationToken cancellationToken) =>
                IdentityUsers(db, db.Users.AsNoTracking().Where(user => user.Id == request.Id))
                    .SingleOrDefaultAsync(cancellationToken);
        }
    }

    /// <summary>Updates the real Identity profile and role atomically.</summary>
    public static class Edit
    {
        public sealed record Command(Guid Id, string FullName, string Email, string? PhoneNumber, UserRole Role) : IRequest<Result>;
        public sealed record Result(AdminActionResult Action, AdminUserDto? User);

        public sealed class Handler(
            AppDbContext db,
            UserManager<AppUser> userManager,
            RoleManager<IdentityRole<Guid>> roleManager) : IRequestHandler<Command, Result>
        {
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                if (request.Role is not (UserRole.Customer or UserRole.Admin))
                    return Fail("User role must be Customer or Admin.");

                var user = await db.Users.SingleOrDefaultAsync(entry => entry.Id == request.Id, cancellationToken);
                if (user is null)
                    return Fail("User was not found.");

                string fullName = request.FullName?.Trim() ?? string.Empty;
                string email = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
                string? phone = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
                if (string.IsNullOrWhiteSpace(fullName))
                    return Fail("Full name is required.");
                if (string.IsNullOrWhiteSpace(email) || !email.Contains('@', StringComparison.Ordinal))
                    return Fail("A valid email is required.");

                var duplicateEmail = await userManager.FindByEmailAsync(email);
                var duplicateName = await userManager.FindByNameAsync(email);
                if ((duplicateEmail is not null && duplicateEmail.Id != user.Id) ||
                    (duplicateName is not null && duplicateName.Id != user.Id))
                    return Fail("Another user already uses this email.");

                bool isAdmin = await userManager.IsInRoleAsync(user, AdminRole);
                if (isAdmin && request.Role == UserRole.Customer)
                {
                    // Never accidentally remove the sole administrator's access.
                    bool hasOtherAdmin = await (
                        from membership in db.UserRoles
                        join identityRole in db.Roles on membership.RoleId equals identityRole.Id
                        where membership.UserId != user.Id && identityRole.NormalizedName == "ADMIN"
                        select membership.UserId
                    ).AnyAsync(cancellationToken);
                    if (!hasOtherAdmin)
                        return Fail("The last administrator cannot be demoted.");
                }

                string desiredRole = request.Role == UserRole.Admin ? AdminRole : CustomerRole;
                string oppositeRole = request.Role == UserRole.Admin ? CustomerRole : AdminRole;
                bool hasDesiredRole = await userManager.IsInRoleAsync(user, desiredRole);
                bool hasOppositeRole = await userManager.IsInRoleAsync(user, oppositeRole);
                bool emailChanged = !string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase);
                bool phoneChanged = !string.Equals(user.PhoneNumber, phone, StringComparison.Ordinal);
                bool roleChanged = !hasDesiredRole || hasOppositeRole;

                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                user.FullName = fullName;
                user.Email = email;
                user.UserName = email; // Login uses email as username.
                user.PhoneNumber = phone;
                if (emailChanged) user.EmailConfirmed = false;
                if (phoneChanged) user.PhoneNumberConfirmed = false;

                var updated = await userManager.UpdateAsync(user);
                if (!updated.Succeeded)
                    return Fail(Errors(updated));

                if (!await roleManager.RoleExistsAsync(desiredRole))
                {
                    var created = await roleManager.CreateAsync(new IdentityRole<Guid>(desiredRole));
                    if (!created.Succeeded)
                        return Fail(Errors(created));
                }

                if (!hasDesiredRole)
                {
                    var added = await userManager.AddToRoleAsync(user, desiredRole);
                    if (!added.Succeeded)
                        return Fail(Errors(added));
                }

                if (hasOppositeRole)
                {
                    var removed = await userManager.RemoveFromRoleAsync(user, oppositeRole);
                    if (!removed.Succeeded)
                        return Fail(Errors(removed));
                }

                // Existing JWTs must not retain an old email/role/verified-phone context.
                if (emailChanged || phoneChanged || roleChanged)
                {
                    var stamped = await userManager.UpdateSecurityStampAsync(user);
                    if (!stamped.Succeeded)
                        return Fail(Errors(stamped));
                }

                await transaction.CommitAsync(cancellationToken);
                return new Result(AdminActionResult.Ok(),
                    new AdminUserDto(user.Id, user.FullName, user.Email ?? string.Empty, user.PhoneNumber, request.Role));
            }

            private static string Errors(IdentityResult result) =>
                string.Join(" ", result.Errors.Select(error => error.Description));
            private static Result Fail(string error) => new(AdminActionResult.Fail(error), null);
        }
    }

    /// <summary>Safe placeholder until a real password-reset delivery flow is available.</summary>
    public static class RequestPasswordReset
    {
        public sealed record Command(Guid Id) : IRequest<AdminActionResult>;

        public sealed class Handler(AppDbContext db) : IRequestHandler<Command, AdminActionResult>
        {
            public async Task<AdminActionResult> Handle(Command request, CancellationToken cancellationToken)
            {
                bool exists = await db.Users.AsNoTracking()
                    .AnyAsync(user => user.Id == request.Id, cancellationToken);
                return exists
                    ? AdminActionResult.Fail("Password reset requires a real auth provider and is not configured yet.")
                    : AdminActionResult.Fail("User was not found.");
            }
        }
    }
}
