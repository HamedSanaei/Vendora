using Domain.Common;

namespace Domain.Entities;

/// <summary>A direct answer; official authorship is assigned by the server at creation.</summary>
public sealed class ProductAnswer : AuditableEntity
{
    public Guid QuestionId { get; set; }
    public Guid UserId { get; set; }
    public string Content { get; set; } = string.Empty;
    public bool IsHidden { get; set; }
    public bool IsOfficial { get; set; }
}
