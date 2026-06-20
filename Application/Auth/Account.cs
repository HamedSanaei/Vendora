using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Persistence;
using Persistence.Identity;

namespace Application.Auth;

/// <summary>
/// Authentication and account management use cases.
/// </summary>
public static class Account
{
    /// <summary>Represents the authenticated account payload returned to clients.</summary>
    public sealed record AccountDto(Guid Id, string FullName, string Email, string Role, string Token, string? PhoneNumber, string? Bio);

    /// <summary>Represents the current account payload.</summary>
    public sealed record CurrentAccountDto(Guid Id, string FullName, string Email, string Role, string? PhoneNumber, string? Bio);

    /// <summary>Represents a customer shipping address payload.</summary>
    public sealed record AddressDto(
        Guid Id,
        string Title,
        string RecipientName,
        string PhoneNumber,
        string Province,
        string City,
        string StreetAddress,
        string? Plaque,
        string? Unit,
        string PostalCode,
        bool IsDefault);

    /// <summary>Represents editable shipping address input.</summary>
    public sealed record AddressInput(
        string? Title,
        string RecipientName,
        string PhoneNumber,
        string Province,
        string City,
        string StreetAddress,
        string? Plaque,
        string? Unit,
        string PostalCode,
        bool IsDefault);

    /// <summary>Represents a command result.</summary>
    public sealed record Result(bool Succeeded, string? Error, AccountDto? Account = null, string? Token = null)
    {
        /// <summary>Creates a failed result.</summary>
        public static Result Fail(string error) => new(false, error);
    }

    /// <summary>Registers a customer account.</summary>
    public static class Register
    {
        /// <summary>Represents a customer registration command.</summary>
        public sealed record Command(string FullName, string Email, string Password, string? PhoneNumber) : IRequest<Result>;

        /// <summary>Handles customer registration.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
        {
            private readonly UserManager<AppUser> _userManager;
            private readonly RoleManager<IdentityRole<Guid>> _roleManager;
            private readonly IConfiguration _configuration;

            /// <summary>Creates the handler.</summary>
            public Handler(UserManager<AppUser> userManager, RoleManager<IdentityRole<Guid>> roleManager, IConfiguration configuration)
            {
                _userManager = userManager;
                _roleManager = roleManager;
                _configuration = configuration;
            }

            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                return await CreateUserAsync(
                    _userManager,
                    _roleManager,
                    _configuration,
                    request.FullName,
                    request.Email,
                    request.Password,
                    request.PhoneNumber,
                    UserRole.Customer.ToString(),
                    cancellationToken);
            }
        }
    }

    /// <summary>Registers an admin account when the configured invite code matches.</summary>
    public static class RegisterAdmin
    {
        /// <summary>Represents an admin registration command.</summary>
        public sealed record Command(string FullName, string Email, string Password, string? PhoneNumber, string InviteCode) : IRequest<Result>;

        /// <summary>Handles admin registration.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
        {
            private readonly UserManager<AppUser> _userManager;
            private readonly RoleManager<IdentityRole<Guid>> _roleManager;
            private readonly IConfiguration _configuration;

            /// <summary>Creates the handler.</summary>
            public Handler(UserManager<AppUser> userManager, RoleManager<IdentityRole<Guid>> roleManager, IConfiguration configuration)
            {
                _userManager = userManager;
                _roleManager = roleManager;
                _configuration = configuration;
            }

            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                string configuredInviteCode = _configuration["Auth:AdminInviteCode"] ?? "DEV-ADMIN-INVITE";
                if (!string.Equals(configuredInviteCode, request.InviteCode, StringComparison.Ordinal))
                {
                    return Result.Fail("Admin invite code is invalid.");
                }

                return await CreateUserAsync(
                    _userManager,
                    _roleManager,
                    _configuration,
                    request.FullName,
                    request.Email,
                    request.Password,
                    request.PhoneNumber,
                    UserRole.Admin.ToString(),
                    cancellationToken);
            }
        }
    }

    /// <summary>Logs a user in and returns a bearer token.</summary>
    public static class Login
    {
        /// <summary>Represents a login command.</summary>
        public sealed record Command(string Email, string Password) : IRequest<Result>;

        /// <summary>Handles login commands.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
        {
            private readonly SignInManager<AppUser> _signInManager;
            private readonly UserManager<AppUser> _userManager;
            private readonly IConfiguration _configuration;

            /// <summary>Creates the handler.</summary>
            public Handler(SignInManager<AppUser> signInManager, UserManager<AppUser> userManager, IConfiguration configuration)
            {
                _signInManager = signInManager;
                _userManager = userManager;
                _configuration = configuration;
            }

            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                var user = await _userManager.FindByEmailAsync(request.Email.Trim());
                if (user is null)
                {
                    return Result.Fail("Invalid email or password.");
                }

                var signInResult = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
                if (!signInResult.Succeeded)
                {
                    return Result.Fail(signInResult.IsNotAllowed
                        ? "Account is not allowed to sign in yet."
                        : "Invalid email or password.");
                }

                string role = await ResolveRoleAsync(_userManager, user);
                string token = await CreateTokenAsync(_userManager, _configuration, user, role);
                return new Result(true, null, new AccountDto(user.Id, user.FullName, user.Email ?? string.Empty, role, token, user.PhoneNumber, user.Bio));
            }
        }
    }

    /// <summary>Returns the currently authenticated user's profile.</summary>
    public static class Me
    {
        /// <summary>Represents a current-account query.</summary>
        public sealed record Query(Guid UserId) : IRequest<CurrentAccountDto?>;

        /// <summary>Handles current-account queries.</summary>
        public sealed class Handler : IRequestHandler<Query, CurrentAccountDto?>
        {
            private readonly UserManager<AppUser> _userManager;

            /// <summary>Creates the handler.</summary>
            public Handler(UserManager<AppUser> userManager)
            {
                _userManager = userManager;
            }

            /// <inheritdoc />
            public async Task<CurrentAccountDto?> Handle(Query request, CancellationToken cancellationToken)
            {
                var user = await _userManager.FindByIdAsync(request.UserId.ToString());
                if (user is null)
                {
                    return null;
                }

                string role = await ResolveRoleAsync(_userManager, user);
                return new CurrentAccountDto(user.Id, user.FullName, user.Email ?? string.Empty, role, user.PhoneNumber, user.Bio);
            }
        }
    }

    /// <summary>Updates the currently authenticated user's profile data.</summary>
    public static class UpdateProfile
    {
        /// <summary>Represents a profile update command.</summary>
        public sealed record Command(Guid UserId, string FullName, string Email, string? PhoneNumber, string? Bio) : IRequest<Result>;

        /// <summary>Handles profile update commands.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
        {
            private readonly UserManager<AppUser> _userManager;

            /// <summary>Creates the handler.</summary>
            public Handler(UserManager<AppUser> userManager)
            {
                _userManager = userManager;
            }

            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                var user = await _userManager.FindByIdAsync(request.UserId.ToString());
                if (user is null)
                {
                    return Result.Fail("User was not found.");
                }

                string fullName = request.FullName.Trim();
                string email = request.Email.Trim();
                string? phoneNumber = NormalizeDigits(request.PhoneNumber)?.Trim();

                if (string.IsNullOrWhiteSpace(fullName))
                {
                    return Result.Fail("Full name is required.");
                }

                if (string.IsNullOrWhiteSpace(email))
                {
                    return Result.Fail("Email is required.");
                }

                if (!string.IsNullOrWhiteSpace(phoneNumber) && !IsIranianMobile(phoneNumber))
                {
                    return Result.Fail("Phone number must be a valid Iranian mobile number.");
                }

                if (!string.Equals(user.Email, email, StringComparison.OrdinalIgnoreCase))
                {
                    var existing = await _userManager.FindByEmailAsync(email);
                    if (existing is not null && existing.Id != user.Id)
                    {
                        return Result.Fail("Email is already used by another account.");
                    }

                    var emailResult = await _userManager.SetEmailAsync(user, email);
                    if (!emailResult.Succeeded)
                    {
                        return Result.Fail(string.Join(" ", emailResult.Errors.Select(error => error.Description)));
                    }

                    var usernameResult = await _userManager.SetUserNameAsync(user, email);
                    if (!usernameResult.Succeeded)
                    {
                        return Result.Fail(string.Join(" ", usernameResult.Errors.Select(error => error.Description)));
                    }
                }

                user.FullName = fullName;
                user.PhoneNumber = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber;
                user.Bio = string.IsNullOrWhiteSpace(request.Bio) ? null : request.Bio.Trim();

                var updateResult = await _userManager.UpdateAsync(user);
                if (!updateResult.Succeeded)
                {
                    return Result.Fail(string.Join(" ", updateResult.Errors.Select(error => error.Description)));
                }

                string role = await ResolveRoleAsync(_userManager, user);
                string token = string.Empty;
                return new Result(true, null, new AccountDto(user.Id, user.FullName, user.Email ?? string.Empty, role, token, user.PhoneNumber, user.Bio));
            }
        }
    }

    /// <summary>Returns customer shipping addresses.</summary>
    public static class ListAddresses
    {
        /// <summary>Represents an address list query.</summary>
        public sealed record Query(Guid UserId) : IRequest<IReadOnlyList<AddressDto>>;

        /// <summary>Handles customer address list queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<AddressDto>>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<IReadOnlyList<AddressDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                return await _dbContext.CustomerAddresses
                    .AsNoTracking()
                    .Where(address => address.UserId == request.UserId)
                    .OrderByDescending(address => address.IsDefault)
                    .ThenBy(address => address.Title)
                    .Select(address => new AddressDto(
                        address.Id,
                        address.Title,
                        address.RecipientName,
                        address.PhoneNumber,
                        address.Province,
                        address.City,
                        address.StreetAddress,
                        address.Plaque,
                        address.Unit,
                        address.PostalCode,
                        address.IsDefault))
                    .ToListAsync(cancellationToken);
            }
        }
    }

    /// <summary>Creates a customer shipping address.</summary>
    public static class CreateAddress
    {
        /// <summary>Represents a create-address command.</summary>
        public sealed record Command(Guid UserId, AddressInput Address) : IRequest<Result>;

        /// <summary>Handles create-address commands.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                var address = new CustomerAddress { UserId = request.UserId };
                string? error = ApplyAddress(address, request.Address);
                if (error is not null)
                {
                    return Result.Fail(error);
                }

                bool hasAnyAddress = await _dbContext.CustomerAddresses.AnyAsync(x => x.UserId == request.UserId, cancellationToken);
                address.IsDefault = request.Address.IsDefault || !hasAnyAddress;
                if (address.IsDefault)
                {
                    await ClearDefaultAddressAsync(_dbContext, request.UserId, null, cancellationToken);
                }

                await _dbContext.CustomerAddresses.AddAsync(address, cancellationToken);
                await _dbContext.SaveChangesAsync(cancellationToken);
                return new Result(true, null, Token: address.Id.ToString());
            }
        }
    }

    /// <summary>Updates an existing customer shipping address.</summary>
    public static class UpdateAddress
    {
        /// <summary>Represents an update-address command.</summary>
        public sealed record Command(Guid UserId, Guid AddressId, AddressInput Address) : IRequest<Result>;

        /// <summary>Handles update-address commands.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                var address = await _dbContext.CustomerAddresses
                    .SingleOrDefaultAsync(x => x.Id == request.AddressId && x.UserId == request.UserId, cancellationToken);
                if (address is null)
                {
                    return Result.Fail("Address was not found.");
                }

                string? error = ApplyAddress(address, request.Address);
                if (error is not null)
                {
                    return Result.Fail(error);
                }

                if (request.Address.IsDefault)
                {
                    await ClearDefaultAddressAsync(_dbContext, request.UserId, address.Id, cancellationToken);
                    address.IsDefault = true;
                }
                else if (address.IsDefault && await _dbContext.CustomerAddresses.CountAsync(x => x.UserId == request.UserId, cancellationToken) == 1)
                {
                    address.IsDefault = true;
                }
                else
                {
                    address.IsDefault = false;
                }

                await _dbContext.SaveChangesAsync(cancellationToken);
                return new Result(true, null, Token: address.Id.ToString());
            }
        }
    }

    /// <summary>Deletes a customer shipping address.</summary>
    public static class DeleteAddress
    {
        /// <summary>Represents a delete-address command.</summary>
        public sealed record Command(Guid UserId, Guid AddressId) : IRequest<Result>;

        /// <summary>Handles delete-address commands.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                var address = await _dbContext.CustomerAddresses
                    .SingleOrDefaultAsync(x => x.Id == request.AddressId && x.UserId == request.UserId, cancellationToken);
                if (address is null)
                {
                    return Result.Fail("Address was not found.");
                }

                bool wasDefault = address.IsDefault;
                _dbContext.CustomerAddresses.Remove(address);
                await _dbContext.SaveChangesAsync(cancellationToken);

                if (wasDefault)
                {
                    var nextAddress = await _dbContext.CustomerAddresses
                        .Where(x => x.UserId == request.UserId)
                        .OrderBy(x => x.CreatedAtUtc)
                        .FirstOrDefaultAsync(cancellationToken);
                    if (nextAddress is not null)
                    {
                        nextAddress.IsDefault = true;
                        await _dbContext.SaveChangesAsync(cancellationToken);
                    }
                }

                return new Result(true, null);
            }
        }
    }

    /// <summary>Marks one address as the customer's default shipping address.</summary>
    public static class SetDefaultAddress
    {
        /// <summary>Represents a set-default-address command.</summary>
        public sealed record Command(Guid UserId, Guid AddressId) : IRequest<Result>;

        /// <summary>Handles set-default-address commands.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                var address = await _dbContext.CustomerAddresses
                    .SingleOrDefaultAsync(x => x.Id == request.AddressId && x.UserId == request.UserId, cancellationToken);
                if (address is null)
                {
                    return Result.Fail("Address was not found.");
                }

                await ClearDefaultAddressAsync(_dbContext, request.UserId, address.Id, cancellationToken);
                address.IsDefault = true;
                await _dbContext.SaveChangesAsync(cancellationToken);
                return new Result(true, null);
            }
        }
    }

    /// <summary>Generates a password reset token for the caller to deliver through email later.</summary>
    public static class ForgotPassword
    {
        /// <summary>Represents a forgot-password command.</summary>
        public sealed record Command(string Email) : IRequest<Result>;

        /// <summary>Handles forgot-password commands.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
        {
            private readonly UserManager<AppUser> _userManager;

            /// <summary>Creates the handler.</summary>
            public Handler(UserManager<AppUser> userManager)
            {
                _userManager = userManager;
            }

            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                var user = await _userManager.FindByEmailAsync(request.Email.Trim());
                if (user is null)
                {
                    return new Result(true, null);
                }

                string token = await _userManager.GeneratePasswordResetTokenAsync(user);
                return new Result(true, null, Token: token);
            }
        }
    }

    /// <summary>Resets a user's password using an Identity reset token.</summary>
    public static class ResetPassword
    {
        /// <summary>Represents a reset-password command.</summary>
        public sealed record Command(string Email, string Token, string NewPassword) : IRequest<Result>;

        /// <summary>Handles reset-password commands.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
        {
            private readonly UserManager<AppUser> _userManager;

            /// <summary>Creates the handler.</summary>
            public Handler(UserManager<AppUser> userManager)
            {
                _userManager = userManager;
            }

            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                var user = await _userManager.FindByEmailAsync(request.Email.Trim());
                if (user is null)
                {
                    return Result.Fail("Password reset token is invalid.");
                }

                var result = await _userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);
                return result.Succeeded
                    ? new Result(true, null)
                    : Result.Fail(string.Join(" ", result.Errors.Select(error => error.Description)));
            }
        }
    }

    private static async Task<Result> CreateUserAsync(
        UserManager<AppUser> userManager,
        RoleManager<IdentityRole<Guid>> roleManager,
        IConfiguration configuration,
        string fullName,
        string email,
        string password,
        string? phoneNumber,
        string role,
        CancellationToken cancellationToken)
    {
        string normalizedFullName = fullName.Trim();
        string normalizedEmail = email.Trim();
        if (string.IsNullOrWhiteSpace(normalizedFullName))
        {
            return Result.Fail("Full name is required.");
        }

        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return Result.Fail("Email is required.");
        }

        await EnsureRoleAsync(roleManager, role);

        var user = new AppUser
        {
            FullName = normalizedFullName,
            UserName = normalizedEmail,
            Email = normalizedEmail,
            EmailConfirmed = !configuration.GetValue("Auth:RequireConfirmedEmail", false),
            PhoneNumber = string.IsNullOrWhiteSpace(phoneNumber) ? null : phoneNumber.Trim()
        };

        var createResult = await userManager.CreateAsync(user, password);
        if (!createResult.Succeeded)
        {
            return Result.Fail(string.Join(" ", createResult.Errors.Select(error => error.Description)));
        }

        var roleResult = await userManager.AddToRoleAsync(user, role);
        if (!roleResult.Succeeded)
        {
            return Result.Fail(string.Join(" ", roleResult.Errors.Select(error => error.Description)));
        }

        string token = await CreateTokenAsync(userManager, configuration, user, role);
        return new Result(true, null, new AccountDto(user.Id, user.FullName, user.Email ?? string.Empty, role, token, user.PhoneNumber, user.Bio));
    }

    private static AddressDto MapAddress(CustomerAddress address)
    {
        return new AddressDto(
            address.Id,
            address.Title,
            address.RecipientName,
            address.PhoneNumber,
            address.Province,
            address.City,
            address.StreetAddress,
            address.Plaque,
            address.Unit,
            address.PostalCode,
            address.IsDefault);
    }

    private static string? ApplyAddress(CustomerAddress address, AddressInput input)
    {
        string postalCode = NormalizeDigits(input.PostalCode)?.Trim() ?? string.Empty;
        string phoneNumber = NormalizeDigits(input.PhoneNumber)?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(input.RecipientName))
        {
            return "Recipient name is required.";
        }

        if (!IsIranianMobile(phoneNumber))
        {
            return "Phone number must be a valid Iranian mobile number.";
        }

        if (string.IsNullOrWhiteSpace(input.Province))
        {
            return "Province is required.";
        }

        if (string.IsNullOrWhiteSpace(input.City))
        {
            return "City is required.";
        }

        if (string.IsNullOrWhiteSpace(input.StreetAddress))
        {
            return "Street address is required.";
        }

        if (!IsIranianPostalCode(postalCode))
        {
            return "Postal code must be a 10-digit Iranian postal code.";
        }

        address.Title = string.IsNullOrWhiteSpace(input.Title) ? "Address" : input.Title.Trim();
        address.RecipientName = input.RecipientName.Trim();
        address.PhoneNumber = phoneNumber;
        address.Province = input.Province.Trim();
        address.City = input.City.Trim();
        address.StreetAddress = input.StreetAddress.Trim();
        address.Plaque = string.IsNullOrWhiteSpace(input.Plaque) ? null : NormalizeDigits(input.Plaque)?.Trim();
        address.Unit = string.IsNullOrWhiteSpace(input.Unit) ? null : NormalizeDigits(input.Unit)?.Trim();
        address.PostalCode = postalCode;
        return null;
    }

    private static async Task ClearDefaultAddressAsync(AppDbContext dbContext, Guid userId, Guid? exceptAddressId, CancellationToken cancellationToken)
    {
        var defaultAddresses = await dbContext.CustomerAddresses
            .Where(address => address.UserId == userId && address.IsDefault && address.Id != exceptAddressId)
            .ToListAsync(cancellationToken);

        foreach (var defaultAddress in defaultAddresses)
        {
            defaultAddress.IsDefault = false;
        }
    }

    private static bool IsIranianMobile(string value)
    {
        return value.Length == 11 && value.StartsWith("09", StringComparison.Ordinal) && value.All(char.IsDigit);
    }

    private static bool IsIranianPostalCode(string value)
    {
        return value.Length == 10 && value.All(char.IsDigit);
    }

    private static string? NormalizeDigits(string? value)
    {
        if (value is null)
        {
            return null;
        }

        var builder = new StringBuilder(value.Length);
        foreach (char character in value)
        {
            builder.Append(character switch
            {
                >= '\u06F0' and <= '\u06F9' => (char)('0' + character - '\u06F0'),
                >= '\u0660' and <= '\u0669' => (char)('0' + character - '\u0660'),
                _ => character
            });
        }

        return builder.ToString();
    }

    private static async Task EnsureRoleAsync(RoleManager<IdentityRole<Guid>> roleManager, string role)
    {
        if (!await roleManager.RoleExistsAsync(role))
        {
            await roleManager.CreateAsync(new IdentityRole<Guid>(role));
        }
    }

    private static async Task<string> ResolveRoleAsync(UserManager<AppUser> userManager, AppUser user)
    {
        var roles = await userManager.GetRolesAsync(user);
        return roles.FirstOrDefault() ?? UserRole.Customer.ToString();
    }

    private static async Task<string> CreateTokenAsync(
        UserManager<AppUser> userManager,
        IConfiguration configuration,
        AppUser user,
        string role)
    {
        string issuer = configuration["Jwt:Issuer"] ?? "Vendora";
        string audience = configuration["Jwt:Audience"] ?? "Vendora.Clients";
        string secret = configuration["Jwt:Key"] ?? "vendora-development-jwt-signing-key-change-before-production";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Role, role)
        };

        foreach (var claim in await userManager.GetClaimsAsync(user))
        {
            claims.Add(claim);
        }

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
