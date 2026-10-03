using System.ComponentModel.DataAnnotations;
using Application.Interfaces;
using Application.Slideshow;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

/// <summary>Public slideshow reads and admin-only multipart photo management.</summary>
[ApiController]
[Route("api/slideshow")]
public sealed class SlideshowController(ISender mediator) : ControllerBase
{
    /// <summary>Returns the persisted playlist in deterministic display order, including an empty list.</summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult> GetSlides(CancellationToken cancellationToken)
    {
        return Ok(await mediator.Send(new SlideshowSlides.List.Query(), cancellationToken));
    }

    /// <summary>Returns the same playlist for an authenticated administrator.</summary>
    [HttpGet("~/api/admin/slideshow")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> GetAdminSlides(CancellationToken cancellationToken)
    {
        return Ok(await mediator.Send(new SlideshowSlides.List.Query(), cancellationToken));
    }

    /// <summary>Uploads a required photo and saves its order and duration.</summary>
    [HttpPost("~/api/admin/slideshow")]
    [Authorize(Policy = "AdminOnly")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult> CreateSlide([FromForm] SlideshowRequest request, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new SlideshowSlides.Create.Command(
            ToUpload(request.Image), request.SortOrder!.Value, request.DurationSeconds!.Value), cancellationToken);
        return result.Failure == SlideshowSlides.Failure.None
            ? Created($"/api/admin/slideshow/{result.Slide!.Id}", result.Slide)
            : BadRequest(new { message = result.Error });
    }

    /// <summary>Updates a photo's settings; omitting the file retains the current image.</summary>
    [HttpPut("~/api/admin/slideshow/{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    public async Task<ActionResult> EditSlide(Guid id, [FromForm] SlideshowRequest request, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new SlideshowSlides.Edit.Command(
            id, ToUpload(request.Image), request.SortOrder!.Value, request.DurationSeconds!.Value), cancellationToken);
        return result.Failure switch
        {
            SlideshowSlides.Failure.None => Ok(result.Slide),
            SlideshowSlides.Failure.NotFound => NotFound(new { message = result.Error }),
            _ => BadRequest(new { message = result.Error })
        };
    }

    /// <summary>Deletes one configured slide and cleans up its owned upload after commit.</summary>
    [HttpDelete("~/api/admin/slideshow/{id:guid}")]
    [Authorize(Policy = "AdminOnly")]
    public async Task<ActionResult> DeleteSlide(Guid id, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new SlideshowSlides.Delete.Command(id), cancellationToken);
        return result.Failure == SlideshowSlides.Failure.NotFound
            ? NotFound(new { message = result.Error })
            : NoContent();
    }

    /// <summary>Adapts a form file without accepting external URLs or using the supplied name as a storage path.</summary>
    private static ProductImageUpload? ToUpload(IFormFile? image)
    {
        return image is null ? null : new ProductImageUpload(image.FileName, image.ContentType, image.Length, image.OpenReadStream);
    }

    /// <summary>Multipart settings shared by create and update; the create use case requires Image.</summary>
    public sealed class SlideshowRequest
    {
        /// <summary>Gets or sets a JPEG, PNG, or WebP upload, optionally omitted on update.</summary>
        public IFormFile? Image { get; set; }

        /// <summary>Gets or sets the required nonnegative integer display position.</summary>
        [Required]
        [Range(0, int.MaxValue)]
        public int? SortOrder { get; set; }

        /// <summary>Gets or sets the required integer duration between one and 120 seconds.</summary>
        [Required]
        [Range(1, 120)]
        public int? DurationSeconds { get; set; }
    }
}
