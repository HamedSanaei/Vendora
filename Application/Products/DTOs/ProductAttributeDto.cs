namespace Application.Products.DTOs;

/// <summary>Optional input; null on legacy updates preserves assignments, an empty list clears them.</summary>
public sealed record ProductAttributeInput(Guid? CatalogAttributeId, string? Name,
    IReadOnlyList<Guid>? TermIds, IReadOnlyList<string>? Values, bool IsVisible = true);

/// <summary>A resolved specification. Only visible rows are included in public detail responses.</summary>
public sealed record ProductAttributeDto(Guid? CatalogAttributeId, string Name, bool IsVisible,
    int SortOrder, IReadOnlyList<Guid> TermIds, IReadOnlyList<string> Values);
