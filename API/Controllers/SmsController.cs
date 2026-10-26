using System.Security.Claims;
using Application.Sms;
using Application.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace API.Controllers;

/// <summary>Protected messaging controls and customer-only OTP endpoints; never accepts provider credentials.</summary>
[ApiController, Route("api"), ResponseCache(NoStore = true, Location = ResponseCacheLocation.None), ShippingErrors]
public sealed class SmsController(ISender sender) : ControllerBase
{
    [Authorize(Policy="AdminOnly"), HttpGet("admin/store-settings/sms")]
    public async Task<IActionResult> Settings(CancellationToken ct) => Ok(await sender.Send(new SmsManagement.Read(),ct));
    [Authorize(Policy="AdminOnly"), HttpPut("admin/store-settings/sms")]
    public async Task<IActionResult> Save(SmsSettingsView input, CancellationToken ct) => Ok(await sender.Send(new SmsManagement.Save(input),ct));
    [Authorize(Policy="AdminOnly"), HttpGet("admin/sms/recipients")]
    public async Task<IActionResult> Recipients(CancellationToken ct) => Ok(await sender.Send(new SmsManagement.Recipients(),ct));
    [Authorize(Policy="AdminOnly"), HttpGet("admin/sms/messages")]
    public async Task<IActionResult> History(int page=1, string? status=null, CancellationToken ct=default) => Ok(await sender.Send(new SmsManagement.History(page,status),ct));
    [Authorize(Policy="AdminOnly"), EnableRateLimiting("discussion-write"), HttpPost("admin/sms/send")]
    public async Task<IActionResult> Send(ManualInput input, CancellationToken ct) => Ok(new { id = await sender.Send(new SmsManagement.Send(Actor(),input.UserId,input.Text,Key()),ct) });
    [Authorize(Policy="AdminOnly"), EnableRateLimiting("discussion-write"), HttpPost("admin/sms/test")]
    public async Task<IActionResult> Test(CancellationToken ct) => Ok(new { id = await sender.Send(new SmsManagement.Send(Actor(),Actor(),"",Key(),true),ct) });
    [Authorize(Policy="AdminOnly"), EnableRateLimiting("sms-ip"), HttpPost("admin/sms/test-code")]
    public async Task<IActionResult> TestCode(CancellationToken ct) => Reply(await sender.Send(new SmsAuthentication.Request("","Test",Actor()),ct));
    [Authorize(Policy="AdminOnly"), EnableRateLimiting("sms-ip"), HttpPost("admin/sms/test-code/verify")]
    public async Task<IActionResult> TestVerify(CodeInput input, CancellationToken ct) => Reply(await sender.Send(new SmsAuthentication.Verify(input.ChallengeId,input.Code,"Test",Actor()),ct));
    [AllowAnonymous, HttpGet("account/auth-options")]
    public async Task<IActionResult> Options(CancellationToken ct) => Ok(await sender.Send(new SmsCapabilities.Query(),ct));
    [AllowAnonymous, EnableRateLimiting("sms-ip"), HttpPost("account/otp/request")]
    public async Task<IActionResult> LoginRequest(PhoneInput input, CancellationToken ct) => Reply(await sender.Send(new SmsAuthentication.Request(input.Phone,"Login"),ct));
    [AllowAnonymous, EnableRateLimiting("sms-ip"), HttpPost("account/otp/verify")]
    public async Task<IActionResult> LoginVerify(CodeInput input, CancellationToken ct) => Reply(await sender.Send(new SmsAuthentication.Verify(input.ChallengeId,input.Code,"Login"),ct));
    [AllowAnonymous, EnableRateLimiting("sms-ip"), HttpPost("account/password/otp/request")]
    public async Task<IActionResult> RecoveryRequest(PhoneInput input, CancellationToken ct) => Reply(await sender.Send(new SmsAuthentication.Request(input.Phone,"Recovery"),ct));
    [AllowAnonymous, EnableRateLimiting("sms-ip"), HttpPost("account/password/otp/verify")]
    public async Task<IActionResult> RecoveryVerify(CodeInput input, CancellationToken ct) => Reply(await sender.Send(new SmsAuthentication.Verify(input.ChallengeId,input.Code,"Recovery"),ct));
    [AllowAnonymous, EnableRateLimiting("sms-ip"), HttpPost("account/password/otp/reset")]
    public async Task<IActionResult> Reset(ResetInput input, CancellationToken ct) => Reply(await sender.Send(new SmsAuthentication.Reset(input.ChallengeId,input.Grant,input.Password),ct));

    /// <summary>Returns only explicit public flow metadata, never an OTP or an Identity reset token.</summary>
    private IActionResult Reply(SmsAuthReply result)
    {
        if (result.RetryAfter > 0 && result.Status == 429) Response.Headers.RetryAfter = result.RetryAfter.ToString();
        return StatusCode(result.Status, new { code = result.Error, result.ChallengeId, result.CodeLength, result.RetryAfter, account = result.Account, result.ResetGrant });
    }
    /// <summary>Uses verified authentication claims rather than user IDs in request bodies.</summary>
    private Guid Actor() => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier),out var id) ? id : throw new Application.Accounting.AccountingException("UNAUTHORIZED",401);
    /// <summary>Requires an explicit retry-safe operation key for billed manual operations.</summary>
    private string Key() => Request.Headers["Idempotency-Key"].FirstOrDefault() ?? throw new Application.Accounting.AccountingException("IDEMPOTENCY_KEY_REQUIRED",400);
    public sealed record ManualInput(Guid UserId,string Text);
    public sealed record PhoneInput(string Phone);
    public sealed record CodeInput(Guid ChallengeId,string Code);
    public sealed record ResetInput(Guid ChallengeId,string Grant,string Password);
}
