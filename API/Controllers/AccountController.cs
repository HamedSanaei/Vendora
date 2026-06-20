using System.Security.Claims;
using Application.Auth;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Exposes account registration, login, and password recovery endpoints.
/// </summary>
[ApiController]
[Route("api")]
public sealed class AccountController : ControllerBase
{
    private readonly ISender _mediator;

    /// <summary>
    /// Creates the account controller.
    /// </summary>
    public AccountController(ISender mediator)
    {
        _mediator = mediator;
    }

    /// <summary>Registers a customer account.</summary>
    [HttpPost("account/register")]
    public async Task<ActionResult> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(
            new Account.Register.Command(request.FullName, request.Email, request.Password, request.PhoneNumber),
            cancellationToken);
        return ToAccountResponse(result);
    }

    /// <summary>Registers an admin account when the invite code is valid.</summary>
    [HttpPost("admin/account/register")]
    public async Task<ActionResult> RegisterAdmin(AdminRegisterRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(
            new Account.RegisterAdmin.Command(
                request.FullName,
                request.Email,
                request.Password,
                request.PhoneNumber,
                request.InviteCode),
            cancellationToken);
        return ToAccountResponse(result);
    }

    /// <summary>Logs a user in.</summary>
    [HttpPost("account/login")]
    public async Task<ActionResult> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new Account.Login.Command(request.Email, request.Password), cancellationToken);
        return ToAccountResponse(result);
    }

    /// <summary>Returns the current authenticated user.</summary>
    [Authorize]
    [HttpGet("account/me")]
    public async Task<ActionResult> Me(CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { message = "User token is invalid." });
        }

        var result = await _mediator.Send(new Account.Me.Query(userId), cancellationToken);
        return result is null ? Unauthorized(new { message = "User was not found." }) : Ok(result);
    }

    /// <summary>Updates the current authenticated user's profile.</summary>
    [Authorize]
    [HttpPut("account/profile")]
    public async Task<ActionResult> UpdateProfile(UpdateProfileRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { message = "User token is invalid." });
        }

        var result = await _mediator.Send(
            new Account.UpdateProfile.Command(userId, request.FullName, request.Email, request.PhoneNumber, request.Bio),
            cancellationToken);
        return result.Succeeded ? Ok(result.Account) : BadRequest(new { message = result.Error });
    }

    /// <summary>Returns the current user's shipping addresses.</summary>
    [Authorize]
    [HttpGet("account/addresses")]
    public async Task<ActionResult> GetAddresses(CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { message = "User token is invalid." });
        }

        var result = await _mediator.Send(new Account.ListAddresses.Query(userId), cancellationToken);
        return Ok(result);
    }

    /// <summary>Creates a shipping address for the current user.</summary>
    [Authorize]
    [HttpPost("account/addresses")]
    public async Task<ActionResult> CreateAddress(AddressRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { message = "User token is invalid." });
        }

        var result = await _mediator.Send(new Account.CreateAddress.Command(userId, ToAddressInput(request)), cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = result.Error });
        }

        var addresses = await _mediator.Send(new Account.ListAddresses.Query(userId), cancellationToken);
        return Created("api/account/addresses", addresses);
    }

    /// <summary>Updates a shipping address owned by the current user.</summary>
    [Authorize]
    [HttpPut("account/addresses/{id:guid}")]
    public async Task<ActionResult> UpdateAddress(Guid id, AddressRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { message = "User token is invalid." });
        }

        var result = await _mediator.Send(new Account.UpdateAddress.Command(userId, id, ToAddressInput(request)), cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = result.Error });
        }

        var addresses = await _mediator.Send(new Account.ListAddresses.Query(userId), cancellationToken);
        return Ok(addresses);
    }

    /// <summary>Deletes a shipping address owned by the current user.</summary>
    [Authorize]
    [HttpDelete("account/addresses/{id:guid}")]
    public async Task<ActionResult> DeleteAddress(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { message = "User token is invalid." });
        }

        var result = await _mediator.Send(new Account.DeleteAddress.Command(userId, id), cancellationToken);
        if (!result.Succeeded)
        {
            return BadRequest(new { message = result.Error });
        }

        return NoContent();
    }

    /// <summary>Marks a shipping address as the current user's default address.</summary>
    [Authorize]
    [HttpPost("account/addresses/{id:guid}/default")]
    public async Task<ActionResult> SetDefaultAddress(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetCurrentUserId(out var userId))
        {
            return Unauthorized(new { message = "User token is invalid." });
        }

        var result = await _mediator.Send(new Account.SetDefaultAddress.Command(userId, id), cancellationToken);
        return result.Succeeded ? NoContent() : BadRequest(new { message = result.Error });
    }

    /// <summary>Creates a password reset token.</summary>
    [HttpPost("account/forgot-password")]
    public async Task<ActionResult> ForgotPassword(ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(new Account.ForgotPassword.Command(request.Email), cancellationToken);
        return result.Succeeded ? Ok(new { message = "Password reset requested.", resetToken = result.Token }) : BadRequest(new { message = result.Error });
    }

    /// <summary>Resets a password using a reset token.</summary>
    [HttpPost("account/reset-password")]
    public async Task<ActionResult> ResetPassword(ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        var result = await _mediator.Send(
            new Account.ResetPassword.Command(request.Email, request.Token, request.NewPassword),
            cancellationToken);
        return result.Succeeded ? Ok(new { message = "Password was reset." }) : BadRequest(new { message = result.Error });
    }

    private ActionResult ToAccountResponse(Account.Result result)
    {
        return result.Succeeded ? Ok(result.Account) : BadRequest(new { message = result.Error });
    }

    private bool TryGetCurrentUserId(out Guid userId)
    {
        string? userIdValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(userIdValue, out userId);
    }

    private static Account.AddressInput ToAddressInput(AddressRequest request)
    {
        return new Account.AddressInput(
            request.Title,
            request.RecipientName,
            request.PhoneNumber,
            request.Province,
            request.City,
            request.StreetAddress,
            request.Plaque,
            request.Unit,
            request.PostalCode,
            request.IsDefault);
    }
}

/// <summary>Represents a registration request.</summary>
public sealed record RegisterRequest(string FullName, string Email, string Password, string? PhoneNumber);

/// <summary>Represents an admin registration request.</summary>
public sealed record AdminRegisterRequest(string FullName, string Email, string Password, string? PhoneNumber, string InviteCode);

/// <summary>Represents a login request.</summary>
public sealed record LoginRequest(string Email, string Password);

/// <summary>Represents a forgot-password request.</summary>
public sealed record ForgotPasswordRequest(string Email);

/// <summary>Represents a reset-password request.</summary>
public sealed record ResetPasswordRequest(string Email, string Token, string NewPassword);

/// <summary>Represents a profile update request.</summary>
public sealed record UpdateProfileRequest(string FullName, string Email, string? PhoneNumber, string? Bio);

/// <summary>Represents a shipping address request.</summary>
public sealed record AddressRequest(
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
