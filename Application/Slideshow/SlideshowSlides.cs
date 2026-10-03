using Application.Interfaces;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Slideshow;

/// <summary>Public reading and protected management use cases for homepage slideshow photos.</summary>
public static class SlideshowSlides
{
    /// <summary>Identifies expected validation and missing-record outcomes.</summary>
    public enum Failure { None, Validation, NotFound }

    /// <summary>The outcome of a slideshow mutation, with a DTO for successful create/update operations.</summary>
    public sealed record Result(Failure Failure, string? Error = null, SlideshowSlideDto? Slide = null);

    /// <summary>Lists all slides for public or admin consumers without changing their state.</summary>
    public static class List
    {
        /// <summary>Requests the deterministic slideshow playlist.</summary>
        public sealed record Query : IRequest<IReadOnlyList<SlideshowSlideDto>>;

        /// <summary>Reads persisted photos ordered by position and then identifier.</summary>
        public sealed class Handler(AppDbContext dbContext) : IRequestHandler<Query, IReadOnlyList<SlideshowSlideDto>>
        {
            /// <inheritdoc />
            public async Task<IReadOnlyList<SlideshowSlideDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                return await dbContext.SlideshowSlides.AsNoTracking()
                    .OrderBy(slide => slide.SortOrder).ThenBy(slide => slide.Id)
                    .Select(slide => new SlideshowSlideDto(slide.Id, slide.ImageUrl, slide.SortOrder, slide.DurationSeconds))
                    .ToListAsync(cancellationToken);
            }
        }
    }

    /// <summary>Uploads and persists a new slideshow photo.</summary>
    public static class Create
    {
        /// <summary>Requests a new photo; image is required and settings are validated before upload.</summary>
        public sealed record Command(ProductImageUpload? Image, int SortOrder, int DurationSeconds) : IRequest<Result>;

        /// <summary>Creates a slide and removes its new image if persistence fails.</summary>
        public sealed class Handler(AppDbContext dbContext, IProductImageStorage imageStorage) : IRequestHandler<Command, Result>
        {
            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                string? error = SlideshowValidation.ValidateSettings(request.SortOrder, request.DurationSeconds);
                if (error is not null)
                {
                    return new Result(Failure.Validation, error);
                }

                if (request.Image is null)
                {
                    return new Result(Failure.Validation, "An image is required.");
                }

                error = await SlideshowValidation.ValidateImageAsync(request.Image, cancellationToken);
                if (error is not null)
                {
                    return new Result(Failure.Validation, error);
                }

                var stored = await imageStorage.SaveAsync(request.Image, cancellationToken);
                var slide = new SlideshowSlide
                {
                    ImageUrl = stored.Url,
                    SortOrder = request.SortOrder,
                    DurationSeconds = request.DurationSeconds
                };
                try
                {
                    dbContext.SlideshowSlides.Add(slide);
                    await dbContext.SaveChangesAsync(cancellationToken);
                }
                catch
                {
                    dbContext.Entry(slide).State = EntityState.Detached;
                    await imageStorage.DeleteAsync(stored.Url, CancellationToken.None);
                    throw;
                }

                return new Result(Failure.None, Slide: SlideshowMappings.Map(slide));
            }
        }
    }

    /// <summary>Changes playback settings and optionally replaces an existing photo.</summary>
    public static class Edit
    {
        /// <summary>Requests an update; omitting Image keeps the existing file and URL.</summary>
        public sealed record Command(Guid Id, ProductImageUpload? Image, int SortOrder, int DurationSeconds) : IRequest<Result>;

        /// <summary>Updates an existing slide, replacing files only after validation and database commit.</summary>
        public sealed class Handler(AppDbContext dbContext, IProductImageStorage imageStorage) : IRequestHandler<Command, Result>
        {
            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                var slide = await dbContext.SlideshowSlides.FindAsync([request.Id], cancellationToken);
                if (slide is null)
                {
                    return new Result(Failure.NotFound, "Slideshow photo was not found.");
                }

                string? error = SlideshowValidation.ValidateSettings(request.SortOrder, request.DurationSeconds);
                if (error is not null)
                {
                    return new Result(Failure.Validation, error);
                }

                if (request.Image is not null)
                {
                    error = await SlideshowValidation.ValidateImageAsync(request.Image, cancellationToken);
                    if (error is not null)
                    {
                        return new Result(Failure.Validation, error);
                    }
                }

                string originalUrl = slide.ImageUrl;
                StoredProductImage? stored = request.Image is null
                    ? null
                    : await imageStorage.SaveAsync(request.Image, cancellationToken);
                try
                {
                    slide.ImageUrl = stored?.Url ?? originalUrl;
                    slide.SortOrder = request.SortOrder;
                    slide.DurationSeconds = request.DurationSeconds;
                    await dbContext.SaveChangesAsync(cancellationToken);
                }
                catch
                {
                    dbContext.Entry(slide).State = EntityState.Detached;
                    if (stored is not null)
                    {
                        await imageStorage.DeleteAsync(stored.Url, CancellationToken.None);
                    }
                    throw;
                }

                if (stored is not null)
                {
                    await imageStorage.DeleteAsync(originalUrl, CancellationToken.None);
                }
                return new Result(Failure.None, Slide: SlideshowMappings.Map(slide));
            }
        }
    }

    /// <summary>Removes a slideshow record and its owned uploaded image.</summary>
    public static class Delete
    {
        /// <summary>Requests removal of one photo by identifier.</summary>
        public sealed record Command(Guid Id) : IRequest<Result>;

        /// <summary>Removes only the requested slideshow record, then best-effort cleans up its file.</summary>
        public sealed class Handler(AppDbContext dbContext, IProductImageStorage imageStorage) : IRequestHandler<Command, Result>
        {
            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                var slide = await dbContext.SlideshowSlides.FindAsync([request.Id], cancellationToken);
                if (slide is null)
                {
                    return new Result(Failure.NotFound, "Slideshow photo was not found.");
                }

                dbContext.SlideshowSlides.Remove(slide);
                await dbContext.SaveChangesAsync(cancellationToken);
                await imageStorage.DeleteAsync(slide.ImageUrl, CancellationToken.None);
                return new Result(Failure.None);
            }
        }
    }
}
