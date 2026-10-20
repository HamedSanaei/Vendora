namespace Domain.Entities;

/// <summary>Editorial search/social metadata and the last deterministic content assessment.</summary>
public sealed class SeoMetadata
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? FocusKeyphrase { get; set; }
    public string? RelatedKeyphrases { get; set; }
    public string? CanonicalUrl { get; set; }
    public bool Index { get; set; } = true;
    public bool Follow { get; set; } = true;
    public string? SocialTitle { get; set; }
    public string? SocialDescription { get; set; }
    public string? SocialImageUrl { get; set; }
    public int? Score { get; set; }
    public string? AnalysisVersion { get; set; }
}
