using Application.Products.DTOs;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Products;

/// <summary>Validates and resolves all specifications before product or image writes take place.</summary>
internal static class ProductAttributeWriter
{
    /// <summary>Resolves global term ownership, archival rules, limits and duplicates without changing the database.</summary>
    internal static async Task<(List<ProductAttribute>? Attributes, string? Error)> ResolveAsync(
        AppDbContext db, IReadOnlyList<ProductAttributeInput>? inputs, Product? existing, CancellationToken ct)
    {
        if (inputs is null) return (null, null);
        if (inputs.Any(x => x is null)) return (null, "Attributes: empty attribute rows are not allowed.");
        if (inputs.Count > 30) return (null, "Attributes: a product can have at most 30 attributes.");
        var ids = inputs.Where(x => x.CatalogAttributeId.HasValue).Select(x => x.CatalogAttributeId!.Value).Distinct().ToList();
        var globals = await db.CatalogAttributes.Include(x => x.Terms).Where(x => ids.Contains(x.Id)).ToListAsync(ct);
        var result = new List<ProductAttribute>();
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var globalIds = new HashSet<Guid>();
        foreach (var input in inputs)
        {
            var row = new ProductAttribute { SortOrder = result.Count, IsVisible = input.IsVisible };
            if (input.CatalogAttributeId is Guid id)
            {
                var definition = globals.SingleOrDefault(x => x.Id == id);
                var previous = existing?.Attributes.SingleOrDefault(x => x.CatalogAttributeId == id);
                if (definition is null || (!definition.IsActive && previous is null))
                    return (null, "Attributes: the selected global attribute is missing or inactive.");
                if (!globalIds.Add(id)) return (null, "Attributes: a global attribute cannot be selected twice.");
                if (!string.IsNullOrWhiteSpace(input.Name) || input.Values?.Count > 0)
                    return (null, "Attributes: global attributes accept term identifiers, not custom names or values.");
                var terms = input.TermIds ?? [];
                if (terms.Count is < 1 or > 30 || terms.Distinct().Count() != terms.Count)
                    return (null, "Attributes: select between 1 and 30 distinct values per attribute.");
                row.CatalogAttributeId = id;
                row.CatalogAttribute = definition;
                foreach (var termId in terms)
                {
                    var term = definition.Terms.SingleOrDefault(x => x.Id == termId);
                    if (term is null || ((!term.IsActive || !definition.IsActive) && previous?.Values.All(x => x.CatalogAttributeTermId != termId) != false))
                        return (null, "Attributes: a value is inactive, missing, or belongs to another attribute.");
                    row.Values.Add(new ProductAttributeValue { CatalogAttributeTermId = termId, CatalogAttributeTerm = term, SortOrder = row.Values.Count });
                }
            }
            else
            {
                string name = input.Name?.Trim() ?? "";
                var values = input.Values ?? [];
                if (name.Length is < 1 or > 100 || input.TermIds?.Count > 0)
                    return (null, "Attributes: custom attributes require a name of 1–100 characters and plain-text values.");
                if (values.Count is < 1 or > 30 || values.Any(x => string.IsNullOrWhiteSpace(x) || x.Trim().Length > 500)
                    || values.Select(x => x.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() != values.Count)
                    return (null, "Attributes: enter 1–30 distinct values, each at most 500 characters.");
                row.CustomName = name;
                row.Values = values.Select((value, index) => new ProductAttributeValue { CustomValue = value.Trim(), SortOrder = index }).ToList();
            }
            if (!names.Add(row.CatalogAttribute?.Name ?? row.CustomName!))
                return (null, "Attributes: attribute names must not be duplicated on the product.");
            result.Add(row);
        }
        return (result, null);
    }

    /// <summary>Maps ordered rows through the established product mapping convention; hidden rows never leave public APIs.</summary>
    internal static IReadOnlyList<ProductAttributeDto> Map(IEnumerable<ProductAttribute> rows, bool publicOnly = false)
        => rows.Where(x => !publicOnly || x.IsVisible).OrderBy(x => x.SortOrder)
            .Select(x => new ProductAttributeDto(x.CatalogAttributeId, x.CatalogAttribute?.Name ?? x.CustomName!, x.IsVisible, x.SortOrder,
                x.Values.OrderBy(v => v.SortOrder).Where(v => v.CatalogAttributeTermId.HasValue).Select(v => v.CatalogAttributeTermId!.Value).ToList(),
                x.Values.OrderBy(v => v.SortOrder).Select(v => v.CatalogAttributeTerm?.Name ?? v.CustomValue!).ToList())).ToList();
}
