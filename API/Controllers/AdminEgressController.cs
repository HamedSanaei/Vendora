using Application.Egress;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace API.Controllers;

/// <summary>Administrator-only outbound settings and fixed-destination tests.</summary>
[ApiController, Authorize(Policy = "AdminOnly"), Route("api/admin/egress"), ShippingErrors]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AdminEgressController(ISender sender) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Read(CancellationToken ct) => Ok(await sender.Send(new ManageEgress.Read(), ct));

    [HttpPut("profiles")]
    public async Task<IActionResult> Save(ManageEgress.ProfileInput input, CancellationToken ct) =>
        Ok(await sender.Send(new ManageEgress.Save(input, Actor()), ct));

    [HttpDelete("profiles/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, Guid version, CancellationToken ct)
    {
        await sender.Send(new ManageEgress.Delete(id, version, Actor()), ct);
        return NoContent();
    }

    public sealed record RouteInput(Guid? Version, bool Enabled, Guid? ProxyId);
    [HttpPut("routes/{service}")]
    public async Task<IActionResult> Assign(string service, RouteInput input, CancellationToken ct)
    {
        await sender.Send(new ManageEgress.Assign(service, input.Version, input.Enabled, input.ProxyId, Actor()), ct);
        return NoContent();
    }

    public sealed record TestInput(string? Service, Guid? ProxyId);
    [HttpPost("test"), EnableRateLimiting("discussion-write")]
    public async Task<IActionResult> Test(TestInput input, CancellationToken ct) =>
        Ok(await sender.Send(new ManageEgress.Test(input.Service, input.ProxyId), ct));

    /// <summary>Records the authenticated administrator, never an identity supplied in the request body.</summary>
    private Guid Actor() => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
        ? id : throw new Application.Accounting.AccountingException("UNAUTHORIZED", 401);
}
