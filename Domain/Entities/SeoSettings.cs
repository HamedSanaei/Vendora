using Domain.Common;

namespace Domain.Entities;

/// <summary>Single-store public search settings. Indexing requires an explicit administrator decision.</summary>
public sealed class SeoSettings : EntityBase
{
    public static readonly Guid SingletonId = Guid.Parse("00000000-0000-0000-0000-000000000002");
    public SeoSettings() => Id = SingletonId;
    public string SiteName { get; set; } = "وندورا";
    public string SiteUrl { get; set; } = "";
    public string? LogoUrl { get; set; }
    public string TitleTemplate { get; set; } = "{title} | {siteName}";
    public string? DefaultDescription { get; set; }
    public string? SocialProfiles { get; set; }
    public bool IsIndexingEnabled { get; set; }
}

/// <summary>Reserves a previously published slug without changing entity identifiers.</summary>
public sealed class SlugHistory : EntityBase
{
    public string Kind { get; set; } = "product";
    public Guid EntityId { get; set; }
    public string Slug { get; set; } = "";
}

/// <summary>An explicit local public-page redirect; it never targets authentication or private flows.</summary>
public sealed class SeoRedirect : EntityBase
{
    public string SourcePath { get; set; } = "";
    public string TargetPath { get; set; } = "";
    public int StatusCode { get; set; } = 301;
    public bool IsActive { get; set; } = true;
}
