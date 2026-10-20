using System.Security.Claims;
using Application.Interfaces;
using Application.Seo;
using Domain.Entities;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>Admin-only editorial SEO APIs. Ordinary analysis is deterministic and never calls AI.</summary>
[ApiController, Route("api/admin/seo"), Authorize(Policy = "AdminOnly")]
public sealed class SeoController(ISender mediator) : ControllerBase
{
    [HttpGet("settings")]
    public async Task<ActionResult> Settings(CancellationToken ct) => Ok(SiteSeoDto.Map(await mediator.Send(new SeoQueries.SettingsQuery(), ct)));
    [HttpPut("settings")]
    public async Task<ActionResult> SaveSettings(SiteSeoDto request, CancellationToken ct)
    {
        var error = await mediator.Send(new SeoQueries.SaveSettings(request.ToEntity()), ct);
        return error is null ? Ok() : BadRequest(new { message = error });
    }
    [HttpPost("analyze"), RequestSizeLimit(1024 * 1024)]
    public async Task<ActionResult> Analyze(SeoDraft request, CancellationToken ct)
    {
        if (request.Kind is not ("product" or "category") || string.IsNullOrWhiteSpace(request.Name) || request.Name.Length > 250 || request.Slug.Length > 280
            || request.Content?.Length > Product.MaxDescriptionLength || request.Images?.Count > 30
            || request.Images?.Any(image => image is null || image.Url?.Length > 1000 || image.Alt?.Length > 250) == true
            || SeoMapping.Validate(request.Seo) is not null)
            return BadRequest(new { message = "SEO: invalid draft." });
        return Ok(await mediator.Send(new SeoQueries.AnalyzeQuery(request), ct));
    }
    [HttpGet("redirects")]
    public async Task<ActionResult> Redirects(CancellationToken ct) => Ok(await mediator.Send(new SeoQueries.RedirectListQuery(), ct));
    [HttpPost("redirects")]
    public async Task<ActionResult> SaveRedirect(SeoQueries.SaveRedirect request, CancellationToken ct)
    {
        var error = await mediator.Send(request, ct);
        return error is null ? Ok() : BadRequest(new { message = error });
    }
    [HttpGet("ai/models")]
    public async Task<ActionResult> Models(CancellationToken ct) => Ok(await mediator.Send(new SeoAi.ModelsQuery(), ct));
    [HttpPost("ai/suggest"), RequestSizeLimit(150_000)]
    public async Task<ActionResult> Suggest(SeoSuggestionRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new SeoAi.SuggestCommand(User.FindFirstValue(ClaimTypes.NameIdentifier)!, request.Operation, request.Draft), ct);
        return result.Error is null ? Ok(result.Suggestion) : StatusCode(result.Status, new { message = result.Error });
    }
}

public sealed record SeoSuggestionRequest(string Operation, SeoDraft Draft);
/// <summary>Explicit public configuration DTO; no authentication, account or inference settings are exposed.</summary>
public sealed record SiteSeoDto(string SiteName, string SiteUrl, string TitleTemplate, bool IsIndexingEnabled,
    string? DefaultDescription = null, string? LogoUrl = null, string? SocialProfiles = null)
{
    public static SiteSeoDto Map(SeoSettings value) => new(value.SiteName, value.SiteUrl, value.TitleTemplate, value.IsIndexingEnabled, value.DefaultDescription, value.LogoUrl, value.SocialProfiles);
    public SeoSettings ToEntity() => new() { SiteName = SiteName, SiteUrl = SiteUrl, TitleTemplate = TitleTemplate,
        IsIndexingEnabled = IsIndexingEnabled, DefaultDescription = DefaultDescription, LogoUrl = LogoUrl, SocialProfiles = SocialProfiles };
}

/// <summary>Read-only crawl configuration. Prices and inventory are supplied by the normal internal catalog only.</summary>
[ApiController, Route("api/catalog/seo")]
public sealed class PublicSeoController(ISender mediator) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult> Settings(CancellationToken ct) => Ok(SiteSeoDto.Map(await mediator.Send(new SeoQueries.SettingsQuery(), ct)));
    [HttpGet("redirect")]
    public async Task<ActionResult> Resolve([FromQuery] string path, CancellationToken ct)
        => Ok(await mediator.Send(new SeoQueries.ResolveRedirectQuery(path), ct));
    [HttpGet("sitemap")]
    public async Task<ActionResult> Sitemap(CancellationToken ct) => Ok(await mediator.Send(new SitemapQuery(), ct));
}
