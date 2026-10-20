using Domain.Common;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Attributes;

/// <summary>Reusable product attribute registry. Disabling a definition or term never deletes product data.</summary>
public static class AttributeCatalog
{
    /// <summary>Editable global value; identifiers remain stable across renames.</summary>
    public sealed record TermDto(Guid Id, string Name, string Slug, bool IsActive);
    /// <summary>Global definition and its reusable value options, including archived options for existing products.</summary>
    public sealed record DefinitionDto(Guid Id, string Name, string Slug, bool IsActive, IReadOnlyList<TermDto> Terms);
    /// <summary>Mutation result with a safe HTTP status and optional typed payload.</summary>
    public sealed record Result<T>(int Status, T? Value, string? Error);

    /// <summary>Reads definitions for admin editing; loading this registry does not mutate it.</summary>
    public sealed record ListQuery : IRequest<IReadOnlyList<DefinitionDto>>;

    /// <summary>Handles the global registry read using a bounded number of database queries.</summary>
    public sealed class ListHandler(AppDbContext db) : IRequestHandler<ListQuery, IReadOnlyList<DefinitionDto>>
    {
        /// <inheritdoc />
        public async Task<IReadOnlyList<DefinitionDto>> Handle(ListQuery request, CancellationToken ct)
            => (await db.CatalogAttributes.AsNoTracking().Include(x => x.Terms).AsSplitQuery().OrderBy(x => x.Name).ToListAsync(ct))
                .Select(Map).ToList();
    }

    /// <summary>Creates or edits one global definition, without editing its terms or product assignments.</summary>
    public sealed record SaveDefinition(Guid? Id, string Name, string? Slug, bool IsActive) : IRequest<Result<DefinitionDto>>;

    /// <summary>Validates global definition identity and preserves term references on updates.</summary>
    public sealed class SaveDefinitionHandler(AppDbContext db) : IRequestHandler<SaveDefinition, Result<DefinitionDto>>
    {
        /// <inheritdoc />
        public async Task<Result<DefinitionDto>> Handle(SaveDefinition request, CancellationToken ct)
        {
            string name = request.Name.Trim();
            string slug = SlugHelper.ToSlug(string.IsNullOrWhiteSpace(request.Slug) ? name : request.Slug);
            if (name.Length is < 1 or > 100 || slug.Length is < 1 or > 120)
                return new(400, null, "Attribute name must be 1–100 characters and slug 1–120 characters.");
            if (await db.CatalogAttributes.AnyAsync(x => (x.Slug == slug || x.Name == name) && x.Id != request.Id, ct))
                return new(409, null, "An attribute with this name or slug already exists.");
            var definition = request.Id is Guid id ? await db.CatalogAttributes.Include(x => x.Terms).SingleOrDefaultAsync(x => x.Id == id, ct) : new CatalogAttribute();
            if (definition is null) return new(404, null, "Attribute was not found.");
            definition.Name = name;
            definition.Slug = slug;
            definition.IsActive = request.IsActive;
            if (!request.Id.HasValue) db.CatalogAttributes.Add(definition);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { return new(409, null, "Attribute could not be saved. Reload and check for duplicate slugs."); }
            return new(request.Id.HasValue ? 200 : 201, Map(definition), null);
        }
    }

    /// <summary>Creates or edits one term inside a single global definition.</summary>
    public sealed record SaveTerm(Guid AttributeId, Guid? Id, string Name, string? Slug, bool IsActive) : IRequest<Result<TermDto>>;

    /// <summary>Enforces term ownership and scoped uniqueness, preserving all product references.</summary>
    public sealed class SaveTermHandler(AppDbContext db) : IRequestHandler<SaveTerm, Result<TermDto>>
    {
        /// <inheritdoc />
        public async Task<Result<TermDto>> Handle(SaveTerm request, CancellationToken ct)
        {
            string name = request.Name.Trim();
            string slug = SlugHelper.ToSlug(string.IsNullOrWhiteSpace(request.Slug) ? name : request.Slug);
            if (name.Length is < 1 or > 200 || slug.Length is < 1 or > 220)
                return new(400, null, "Value name must be 1–200 characters and slug 1–220 characters.");
            if (!await db.CatalogAttributes.AnyAsync(x => x.Id == request.AttributeId, ct))
                return new(404, null, "Attribute was not found.");
            if (await db.CatalogAttributeTerms.AnyAsync(x => x.CatalogAttributeId == request.AttributeId && (x.Slug == slug || x.Name == name) && x.Id != request.Id, ct))
                return new(409, null, "This attribute already has a value with this name or slug.");
            var term = request.Id is Guid id
                ? await db.CatalogAttributeTerms.SingleOrDefaultAsync(x => x.Id == id && x.CatalogAttributeId == request.AttributeId, ct)
                : new CatalogAttributeTerm { CatalogAttributeId = request.AttributeId };
            if (term is null) return new(404, null, "Value was not found in this attribute.");
            term.Name = name;
            term.Slug = slug;
            term.IsActive = request.IsActive;
            if (!request.Id.HasValue) db.CatalogAttributeTerms.Add(term);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { return new(409, null, "Value could not be saved. Reload and check for duplicate slugs."); }
            return new(request.Id.HasValue ? 200 : 201, new(term.Id, term.Name, term.Slug, term.IsActive), null);
        }
    }

    /// <summary>Projects persisted registry entities to admin DTOs following the existing catalog mapping pattern.</summary>
    private static DefinitionDto Map(CatalogAttribute definition) => new(definition.Id, definition.Name, definition.Slug, definition.IsActive,
        definition.Terms.OrderBy(x => x.Name).Select(x => new TermDto(x.Id, x.Name, x.Slug, x.IsActive)).ToList());
}
