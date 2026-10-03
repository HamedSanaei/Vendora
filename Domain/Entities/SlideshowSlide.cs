using Domain.Common;

namespace Domain.Entities;

/// <summary>One uploaded homepage slideshow photo with its playback settings.</summary>
public sealed class SlideshowSlide : AuditableEntity
{
    /// <summary>Gets or sets the generated local image URL, never a client-provided URL.</summary>
    public string ImageUrl { get; set; } = string.Empty;

    /// <summary>Gets or sets the nonnegative display position; equal positions are ordered by identifier.</summary>
    public int SortOrder { get; set; }

    /// <summary>Gets or sets the display duration, between one and 120 seconds.</summary>
    public int DurationSeconds { get; set; } = 5;
}
