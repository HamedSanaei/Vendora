using Domain.Common;

namespace Domain.Entities;

/// <summary>A reusable product attribute, such as material or bag size. Archiving preserves existing assignments.</summary>
public sealed class CatalogAttribute : AuditableEntity
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public List<CatalogAttributeTerm> Terms { get; set; } = [];
}

/// <summary>A reusable, named value belonging to exactly one global attribute.</summary>
public sealed class CatalogAttributeTerm : AuditableEntity
{
    public Guid CatalogAttributeId { get; set; }
    public CatalogAttribute CatalogAttribute { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
