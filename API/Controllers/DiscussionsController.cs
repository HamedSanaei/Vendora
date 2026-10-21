using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Application.Discussions;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

/// <summary>Public discussion reads, authenticated writes and role-protected moderation.</summary>
[ApiController]
[Route("api/products/{productId:guid}/discussion")]
public sealed class DiscussionsController(ISender mediator) : ControllerBase
{
    /// <summary>Reads one visible discussion page; no account details are exposed.</summary>
    [HttpGet]
    public async Task<ActionResult> List(Guid productId, string kind = "review", Guid? questionId = null, int page = 1, CancellationToken cancellationToken = default)
    {
        if (kind is not ("review" or "question" or "answer")) return BadRequest();
        var result = await mediator.Send(new DiscussionQueries.List(productId, kind, questionId, page), cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Reads only the current user's review and rating eligibility.</summary>
    [Authorize, HttpGet("me")]
    public async Task<ActionResult> Mine(Guid productId, CancellationToken cancellationToken)
    {
        if (!TryUser(out var user)) return Unauthorized();
        var result = await mediator.Send(new DiscussionQueries.MyReview(productId, user), cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>Creates or edits the caller's unique review; author and buyer flags cannot be posted.</summary>
    [Authorize, EnableRateLimiting("discussion-write"), HttpPut("review")]
    public async Task<ActionResult> Save(Guid productId, ReviewRequest request, CancellationToken cancellationToken)
    {
        if (!TryUser(out var user)) return Unauthorized();
        return Write(await mediator.Send(new DiscussionCommands.SaveReview(productId, user, request.Content, request.Rating), cancellationToken));
    }

    /// <summary>Publishes a new question for the current user.</summary>
    [Authorize, EnableRateLimiting("discussion-write"), HttpPost("questions")]
    public async Task<ActionResult> Ask(Guid productId, QuestionRequest request, CancellationToken cancellationToken)
    {
        if (!TryUser(out var user)) return Unauthorized();
        return Write(await mediator.Send(new DiscussionCommands.Ask(productId, user, request.Content), cancellationToken));
    }

    /// <summary>Publishes a direct answer with official status from the authenticated role.</summary>
    [Authorize, EnableRateLimiting("discussion-write"), HttpPost("questions/{questionId:guid}/answers")]
    public async Task<ActionResult> Answer(Guid productId, Guid questionId, AnswerRequest request, CancellationToken cancellationToken)
    {
        if (!TryUser(out var user)) return Unauthorized();
        return Write(await mediator.Send(new DiscussionCommands.Answer(productId, questionId, user, request.Content, User.IsInRole("Admin")), cancellationToken));
    }

    /// <summary>Lists content for administrators, including hidden entries.</summary>
    [Authorize(Policy = "AdminOnly"), HttpGet("~/api/admin/discussions")]
    public async Task<ActionResult> AdminList(string? kind, Guid? productId, bool? hidden, int page = 1, CancellationToken cancellationToken = default) =>
        Ok(await mediator.Send(new DiscussionQueries.AdminList(kind, productId, hidden, page), cancellationToken));

    /// <summary>Hides or restores content without removing business records.</summary>
    [Authorize(Policy = "AdminOnly"), HttpPatch("~/api/admin/discussions/{kind}/{id:guid}/visibility")]
    public async Task<ActionResult> Visibility(string kind, Guid id, VisibilityRequest request, CancellationToken cancellationToken) =>
        Write(await mediator.Send(new DiscussionCommands.Visibility(kind, id, request.Hidden), cancellationToken));

    /// <summary>Parses a trusted subject claim rather than a supplied user identifier.</summary>
    private bool TryUser(out Guid user) => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out user);
    /// <summary>Maps application outcomes to HTTP without exposing persistence exceptions.</summary>
    private ActionResult Write(DiscussionCommands.Result result) => StatusCode(result.Status, new { id = result.Id, code = result.Error });

    public sealed record ReviewRequest([Required, StringLength(3000)] string Content, [Range(1, 5)] int? Rating);
    public sealed record QuestionRequest([Required, StringLength(2000)] string Content);
    public sealed record AnswerRequest([Required, StringLength(3000)] string Content);
    public sealed record VisibilityRequest(bool Hidden);
}
