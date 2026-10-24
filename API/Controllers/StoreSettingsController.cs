using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Application.Interfaces;
using Application.StoreSettings;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>Public presentation reads and protected multipart store configuration.</summary>
[ApiController, Route("api/store-settings")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class StoreSettingsController(ISender mediator) : ControllerBase
{
    /// <summary>Exposes only the current public sample-data switch; never provenance IDs or administrative metadata.</summary>
    [HttpGet("seed-visibility"), AllowAnonymous]
    public async Task<ActionResult<SeedDisplayUseCases.State>> SeedVisibility(CancellationToken ct)
        => Ok(await mediator.Send(new SeedDisplayUseCases.Query(), ct));

    /// <summary>Allows administrators to change visibility globally without changing any underlying record.</summary>
    [HttpPut("~/api/admin/store-settings/seed-visibility"), Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<SeedDisplayUseCases.State>> SetSeedVisibility(SeedVisibilityInput input, CancellationToken ct)
        => Ok(await mediator.Send(new SeedDisplayUseCases.Set(input.ShowSeedData!.Value), ct));

    /// <summary>An explicit Boolean is required so an empty request cannot inadvertently hide data.</summary>
    public sealed class SeedVisibilityInput
    {
        [Required] public bool? ShowSeedData { get; init; }
    }

    /// <summary>Returns only public presentation overrides; null fields use the existing Vendora defaults.</summary>
    [HttpGet, AllowAnonymous]
    public async Task<ActionResult<StoreProfile>> Get(CancellationToken cancellationToken)
        => Ok(await mediator.Send(new StoreSettingsUseCases.Query(), cancellationToken));

    /// <summary>Reads editable store settings using the existing admin policy.</summary>
    [HttpGet("~/api/admin/store-settings"), Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult<StoreProfile>> GetAdmin(CancellationToken cancellationToken)
        => Ok(await mediator.Send(new StoreSettingsUseCases.Query(), cancellationToken));

    /// <summary>Saves one validated form with optional image replacements, leaving technical SEO untouched.</summary>
    [HttpPut("~/api/admin/store-settings"), Authorize(Policy = "AdminOnly"), RequestSizeLimit(12 * 1024 * 1024)]
    public async Task<ActionResult> Save([FromForm] SettingsForm form, CancellationToken cancellationToken)
    {
        StoreSettingsInput? input;
        try { input = JsonSerializer.Deserialize<StoreSettingsInput>(form.Settings, new JsonSerializerOptions(JsonSerializerDefaults.Web)); }
        catch (JsonException) { return BadRequest(new { errors = new { settings = "invalidSettings" } }); }
        if (input?.Profile is null) return BadRequest(new { errors = new { settings = "invalidSettings" } });
        var result = await mediator.Send(new StoreSettingsUseCases.Command(input, Upload(form.Logo), Upload(form.Favicon)), cancellationToken);
        return result.Errors is null ? Ok(result.Profile) : BadRequest(new { errors = result.Errors });
    }

    /// <summary>Wraps uploaded bytes without trusting the supplied filename as a filesystem path.</summary>
    private static ProductImageUpload? Upload(IFormFile? file) => file is null ? null
        : new(file.FileName, file.ContentType, file.Length, file.OpenReadStream);

    /// <summary>Bounded JSON presentation data and optional validated raster uploads.</summary>
    public sealed class SettingsForm
    {
        [Required, MaxLength(20000)] public string Settings { get; set; } = "";
        public IFormFile? Logo { get; set; }
        public IFormFile? Favicon { get; set; }
    }
}
