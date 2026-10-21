using Domain.Common;

namespace Domain.Entities;

/// <summary>A single editable customer review of a product; a rating requires a delivered purchase.</summary>
public sealed class ProductReview : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Guid UserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public int? Rating { get; set; }
    public bool IsHidden { get; set; }
}
