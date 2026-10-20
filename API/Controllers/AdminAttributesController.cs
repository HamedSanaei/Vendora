using Application.Attributes;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>Admin-only reusable product attributes and terms. Archival is an explicit IsActive update, not deletion.</summary>
[ApiController]
[Route("api/admin/attributes")]
[Authorize(Policy = "AdminOnly")]
public sealed class AdminAttributesController(ISender mediator) : ControllerBase
{
    /// <summary>Lists global definitions and values, including archived entries needed when editing existing products.</summary>
    [HttpGet]
    public async Task<ActionResult> List(CancellationToken ct) => Ok(await mediator.Send(new AttributeCatalog.ListQuery(), ct));

    /// <summary>Creates one reusable global definition.</summary>
    [HttpPost]
    public async Task<ActionResult> Create(AttributeNameRequest request, CancellationToken ct)
        => Respond(await mediator.Send(new AttributeCatalog.SaveDefinition(null, request.Name, request.Slug, request.IsActive), ct));

    /// <summary>Renames or archives a global definition without destroying its assigned values.</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult> Edit(Guid id, AttributeNameRequest request, CancellationToken ct)
        => Respond(await mediator.Send(new AttributeCatalog.SaveDefinition(id, request.Name, request.Slug, request.IsActive), ct));

    /// <summary>Creates a reusable term within a global definition.</summary>
    [HttpPost("{attributeId:guid}/terms")]
    public async Task<ActionResult> CreateTerm(Guid attributeId, AttributeNameRequest request, CancellationToken ct)
        => Respond(await mediator.Send(new AttributeCatalog.SaveTerm(attributeId, null, request.Name, request.Slug, request.IsActive), ct));

    /// <summary>Renames or archives an owned term, preserving existing product assignments.</summary>
    [HttpPut("{attributeId:guid}/terms/{id:guid}")]
    public async Task<ActionResult> EditTerm(Guid attributeId, Guid id, AttributeNameRequest request, CancellationToken ct)
        => Respond(await mediator.Send(new AttributeCatalog.SaveTerm(attributeId, id, request.Name, request.Slug, request.IsActive), ct));

    /// <summary>Maps application outcomes without placing persistence rules in the controller.</summary>
    private ActionResult Respond<T>(AttributeCatalog.Result<T> result)
        => result.Error is null ? StatusCode(result.Status, result.Value) : StatusCode(result.Status, new { message = result.Error });
}

/// <summary>Localized display name, stable slug and non-destructive activation flag.</summary>
public sealed record AttributeNameRequest(string Name, string? Slug = null, bool IsActive = true);
