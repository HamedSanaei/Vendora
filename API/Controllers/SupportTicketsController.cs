using System.Security.Claims;
using Application.Accounting;
using Application.Support;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

/// <summary>One ownership-aware API for account tickets and the Admin support workspace.</summary>
[ApiController,Authorize,Route("api"),ShippingErrors,ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
public sealed class SupportTicketsController(ISender sender) : ControllerBase
{
    [HttpGet("account/tickets")]
    public async Task<IActionResult> Mine(int page=1,string? status=null,CancellationToken ct=default) => Ok(await sender.Send(new SupportTickets.List(Actor(),false,page,status),ct));
    [HttpGet("admin/tickets"),Authorize(Policy="AdminOnly")]
    public async Task<IActionResult> All(int page=1,string? status=null,CancellationToken ct=default) => Ok(await sender.Send(new SupportTickets.List(Actor(),true,page,status),ct));
    [HttpGet("account/tickets/{id:guid}")]
    public Task<IActionResult> MineDetail(Guid id,CancellationToken ct) => Details(id,false,ct);
    [HttpGet("admin/tickets/{id:guid}"),Authorize(Policy="AdminOnly")]
    public Task<IActionResult> AdminDetail(Guid id,CancellationToken ct) => Details(id,true,ct);
    [HttpPost("account/tickets"),EnableRateLimiting("discussion-write")]
    public async Task<IActionResult> Create(CreateInput input,CancellationToken ct) => Ok(new { id = await sender.Send(new SupportTickets.Create(Actor(),Key(),input.Subject,input.Text,input.OrderId),ct) });
    [HttpPost("account/tickets/{id:guid}/messages"),EnableRateLimiting("discussion-write")]
    public Task<IActionResult> MineReply(Guid id,ReplyInput input,CancellationToken ct) => Reply(id,input,false,ct);
    [HttpPost("admin/tickets/{id:guid}/messages"),Authorize(Policy="AdminOnly"),EnableRateLimiting("discussion-write")]
    public Task<IActionResult> AdminReply(Guid id,ReplyInput input,CancellationToken ct) => Reply(id,input,true,ct);
    [HttpPatch("account/tickets/{id:guid}/status"),EnableRateLimiting("discussion-write")]
    public Task<IActionResult> MineStatus(Guid id,StatusInput input,CancellationToken ct) => Status(id,input,false,ct);
    [HttpPatch("admin/tickets/{id:guid}/status"),Authorize(Policy="AdminOnly"),EnableRateLimiting("discussion-write")]
    public Task<IActionResult> AdminStatus(Guid id,StatusInput input,CancellationToken ct) => Status(id,input,true,ct);

    /// <summary>Returns 404 for both missing and unowned conversations.</summary>
    private async Task<IActionResult> Details(Guid id,bool admin,CancellationToken ct) { var value = await sender.Send(new SupportTickets.Detail(Actor(),admin,id),ct); return value is null ? NotFound() : Ok(value); }
    /// <summary>Passes staff identity only from the protected route, ignoring any browser claim.</summary>
    private async Task<IActionResult> Reply(Guid id,ReplyInput input,bool admin,CancellationToken ct) => Ok(new { id = await sender.Send(new SupportTickets.Reply(Actor(),admin,id,input.Version,input.Text,Key()),ct) });
    /// <summary>Closes/reopens using the same ownership and concurrency checks as replies.</summary>
    private async Task<IActionResult> Status(Guid id,StatusInput input,bool admin,CancellationToken ct) => Ok(new { id = await sender.Send(new SupportTickets.SetStatus(Actor(),admin,id,input.Version,input.Close,Key()),ct) });
    private Guid Actor() => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier),out var id) ? id : throw new AccountingException("UNAUTHORIZED",401);
    private string Key() => Request.Headers["Idempotency-Key"].FirstOrDefault() ?? throw new AccountingException("IDEMPOTENCY_KEY_REQUIRED",400);
    public sealed record CreateInput(string Subject,string Text,Guid? OrderId=null);
    public sealed record ReplyInput(long Version,string Text);
    public sealed record StatusInput(long Version,bool Close);
}
