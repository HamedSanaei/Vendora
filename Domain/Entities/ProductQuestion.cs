using Domain.Common;

namespace Domain.Entities;

/// <summary>A public product question with independent, non-nested answers.</summary>
public sealed class ProductQuestion : AuditableEntity
{
    public Guid ProductId { get; set; }
    public Guid UserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsHidden { get; set; }
}
