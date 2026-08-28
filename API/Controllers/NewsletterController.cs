using Application.Newsletter;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>
/// Exposes public newsletter subscription endpoints.
/// </summary>
public sealed class NewsletterController : BaseApiController
{
    /// <summary>
    /// Stores an email submitted from the storefront call-to-action.
    /// </summary>
    [HttpPost("subscriptions")]
    public async Task<ActionResult> Subscribe(NewsletterSubscribeRequest request, CancellationToken cancellationToken)
    {
        var result = await Mediator.Send(new NewsletterSubscriptions.Subscribe.Command(request.Email, request.Locale), cancellationToken);
        return result.Succeeded
            ? Ok(new { message = result.Message, subscription = result.Subscription })
            : BadRequest(new { message = result.Message });
    }
}

/// <summary>
/// Represents a public newsletter subscription request.
/// </summary>
public sealed record NewsletterSubscribeRequest(string Email, string? Locale);
