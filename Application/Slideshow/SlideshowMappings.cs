using Domain.Entities;

namespace Application.Slideshow;

/// <summary>The public and admin representation of one slideshow photo.</summary>
public sealed record SlideshowSlideDto(Guid Id, string ImageUrl, int SortOrder, int DurationSeconds);

/// <summary>Maps slideshow entities using the repository's established explicit mapping convention.</summary>
public static class SlideshowMappings
{
    /// <summary>Returns only the slide fields exposed by the slideshow API.</summary>
    public static SlideshowSlideDto Map(SlideshowSlide slide)
    {
        return new SlideshowSlideDto(slide.Id, slide.ImageUrl, slide.SortOrder, slide.DurationSeconds);
    }
}
