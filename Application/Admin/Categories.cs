using Application.Admin.DTOs;
using Domain.Common;
using Domain.Entities;
using MediatR;
using Persistence.Admin;
using Persistence.Common;
using Persistence;
using Application.Seo;
using Application.Interfaces;
using Application.Catalog;
using Microsoft.EntityFrameworkCore;

namespace Application.Admin;

/// <summary>
/// Category admin use cases.
/// </summary>
public static class Categories
{
    /// <summary>Lists all categories for admin management.</summary>
    public static class List
    {
        /// <summary>Represents the list categories query.</summary>
        public sealed record Query(bool IncludeInactive = true) : IRequest<IReadOnlyList<AdminCategoryDto>>;

        /// <summary>Handles category list queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<AdminCategoryDto>>
        {
            private readonly IAdminRepository _repository;
            private readonly AppDbContext _db;

            /// <summary>Creates the handler.</summary>
            public Handler(IAdminRepository repository, AppDbContext db)
            {
                _repository = repository;
                _db = db;
            }

            /// <inheritdoc />
            public async Task<IReadOnlyList<AdminCategoryDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var categories = await _repository.GetCategoriesAsync(request.IncludeInactive, cancellationToken);
                var graph = new CategoryHierarchy(categories);
                var links = await _db.ProductCategories.AsNoTracking().Select(x => new { x.ProductId, x.CategoryId }).ToListAsync(cancellationToken);
                var legacy = await _db.Products.AsNoTracking().Where(x => x.CategoryId.HasValue).Select(x => new { ProductId = x.Id, CategoryId = x.CategoryId!.Value }).ToListAsync(cancellationToken);
                var allLinks = links.Concat(legacy).Distinct().ToList();
                return categories.Select(category =>
                {
                    var ids = graph.Descendants([category.Id]);
                    return AdminMappings.MapCategory(category) with
                    {
                        ProductCount = allLinks.Where(x => x.CategoryId == category.Id).Select(x => x.ProductId).Distinct().Count(),
                        SubtreeProductCount = allLinks.Where(x => ids.Contains(x.CategoryId)).Select(x => x.ProductId).Distinct().Count()
                    };
                }).ToList();
            }
        }
    }

    /// <summary>Creates a category.</summary>
    public static class Create
    {
        /// <summary>Represents the create category command.</summary>
        public sealed record Command(string Name, string? Slug, Guid? ParentCategoryId, bool IsActive,
            string? Description = null, string? ImageUrl = null, SeoInput? Seo = null) : IRequest<Result>;

        /// <summary>Represents the create result.</summary>
        public sealed record Result(AdminActionResult Action, AdminCategoryDto? Category);

        /// <summary>Handles create category commands.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
        {
            private readonly IAdminRepository _repository;
            private readonly IUnitOfWork _unitOfWork;

            /// <summary>Creates the handler.</summary>
            public Handler(IAdminRepository repository, IUnitOfWork unitOfWork, AppDbContext db, IProductDescriptionService descriptions)
            {
                _repository = repository;
                _unitOfWork = unitOfWork;
                _db = db; _descriptions = descriptions;
            }

            private readonly AppDbContext _db;
            private readonly IProductDescriptionService _descriptions;

            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                if (ValidateContent(request.Description, request.ImageUrl, request.Seo) is string error) return Fail(error);
                string name = request.Name.Trim();
                if (string.IsNullOrWhiteSpace(name))
                {
                    return Fail("Category name is required.");
                }

                string slug = SlugHelper.ToSlug(string.IsNullOrWhiteSpace(request.Slug) ? name : request.Slug);
                if (string.IsNullOrWhiteSpace(slug))
                {
                    return Fail("Category slug could not be generated.");
                }

                if (await _repository.CategorySlugExistsAsync(slug, cancellationToken: cancellationToken))
                {
                    return Fail("A category with this slug already exists.");
                }
                if (slug.Length > 180 || name.Length > 150 || await SeoWriter.ReservedAsync(_db, "category", slug, null, cancellationToken)) return Fail("Category name/slug is too long or the slug is reserved.");

                if (request.ParentCategoryId.HasValue
                    && await _repository.GetCategoryAsync(request.ParentCategoryId.Value, trackChanges: false, cancellationToken) is null)
                {
                    return Fail("Parent category was not found.");
                }

                var category = new Category
                {
                    Name = name,
                    Slug = slug,
                    ParentCategoryId = request.ParentCategoryId,
                    IsActive = request.IsActive
                };
                category.Description = _descriptions.Sanitize(request.Description);
                if (category.Description?.Length > Product.MaxDescriptionLength) return Fail("Sanitized category description is too long.");
                category.ImageUrl = request.ImageUrl;
                category.Seo = await SeoWriter.AssessAsync(_db, new("category", category.Id, category.Name, category.Slug, category.Description, request.Seo,
                    string.IsNullOrWhiteSpace(category.ImageUrl) ? [] : [new(category.ImageUrl, category.Name)]), null, _descriptions, cancellationToken);
                await _repository.AddCategoryAsync(category, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                return new Result(AdminActionResult.Ok(), AdminMappings.MapCategory(category));
            }

            private static Result Fail(string error) => new(AdminActionResult.Fail(error), null);
        }
    }

    /// <summary>Updates a category.</summary>
    public static class Edit
    {
        /// <summary>Represents the edit category command.</summary>
        public sealed record Command(Guid Id, string Name, string? Slug, Guid? ParentCategoryId, bool IsActive,
            string? Description = null, string? ImageUrl = null, SeoInput? Seo = null) : IRequest<Result>;

        /// <summary>Represents the edit result.</summary>
        public sealed record Result(AdminActionResult Action, AdminCategoryDto? Category);

        /// <summary>Handles edit category commands.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
        {
            private readonly IAdminRepository _repository;
            private readonly IUnitOfWork _unitOfWork;

            /// <summary>Creates the handler.</summary>
            public Handler(IAdminRepository repository, IUnitOfWork unitOfWork, AppDbContext db, IProductDescriptionService descriptions)
            {
                _repository = repository;
                _unitOfWork = unitOfWork;
                _db = db; _descriptions = descriptions;
            }

            private readonly AppDbContext _db;
            private readonly IProductDescriptionService _descriptions;

            /// <inheritdoc />
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
                if (ValidateContent(request.Description, request.ImageUrl, request.Seo) is string error) return Fail(error);
                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                var category = await _repository.GetCategoryAsync(request.Id, trackChanges: true, cancellationToken);
                if (category is null)
                {
                    return Fail("Category was not found.");
                }

                string name = request.Name.Trim();
                if (string.IsNullOrWhiteSpace(name))
                {
                    return Fail("Category name is required.");
                }

                string slug = SlugHelper.ToSlug(string.IsNullOrWhiteSpace(request.Slug) ? name : request.Slug);
                if (await _repository.CategorySlugExistsAsync(slug, request.Id, cancellationToken))
                {
                    return Fail("A category with this slug already exists.");
                }

                if (request.ParentCategoryId == request.Id)
                {
                    return Fail("A category cannot be its own parent.");
                }

                if (request.ParentCategoryId.HasValue)
                {
                    if (await _repository.GetCategoryAsync(request.ParentCategoryId.Value, trackChanges: false, cancellationToken) is null)
                    {
                        return Fail("Parent category was not found.");
                    }

                    if (await _repository.IsDescendantCategoryAsync(request.Id, request.ParentCategoryId.Value, cancellationToken))
                    {
                        return Fail("A category cannot use one of its child categories as parent.");
                    }
                }

                if (string.IsNullOrWhiteSpace(slug) || slug.Length > 180 || name.Length > 150 || await SeoWriter.ReservedAsync(_db, "category", slug, category.Id, cancellationToken)) return Fail("Category name/slug is invalid or reserved.");
                await SeoWriter.RememberAsync(_db, "category", category.Id, category.Slug, slug, cancellationToken);
                category.Name = name;
                category.Slug = slug;
                category.ParentCategoryId = request.ParentCategoryId;
                category.IsActive = request.IsActive;
                if (request.Description is not null) category.Description = _descriptions.Sanitize(request.Description);
                if (category.Description?.Length > Product.MaxDescriptionLength) return Fail("Sanitized category description is too long.");
                if (request.ImageUrl is not null) category.ImageUrl = request.ImageUrl;
                category.Seo = await SeoWriter.AssessAsync(_db, new("category", category.Id, category.Name, category.Slug, category.Description, request.Seo,
                    string.IsNullOrWhiteSpace(category.ImageUrl) ? [] : [new(category.ImageUrl, category.Name)]), category.Seo, _descriptions, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                return new Result(AdminActionResult.Ok(), AdminMappings.MapCategory(category));
            }

            private static Result Fail(string error) => new(AdminActionResult.Fail(error), null);
        }
    }

    /// <summary>Soft deletes a category.</summary>
    public static class Delete
    {
        /// <summary>Represents the delete category command.</summary>
        public sealed record Command(Guid Id) : IRequest<AdminActionResult>;

        /// <summary>Handles delete category commands.</summary>
        public sealed class Handler : IRequestHandler<Command, AdminActionResult>
        {
            private readonly IAdminRepository _repository;
            private readonly IUnitOfWork _unitOfWork;

            /// <summary>Creates the handler.</summary>
            public Handler(IAdminRepository repository, IUnitOfWork unitOfWork)
            {
                _repository = repository;
                _unitOfWork = unitOfWork;
            }

            /// <inheritdoc />
            public async Task<AdminActionResult> Handle(Command request, CancellationToken cancellationToken)
            {
                var category = await _repository.GetCategoryAsync(request.Id, trackChanges: true, cancellationToken);
                if (category is null)
                {
                    return AdminActionResult.Fail("Category was not found.");
                }

                category.IsActive = false;
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return AdminActionResult.Ok();
            }
        }
    }

    /// <summary>Applies shared article/URL limits before taxonomy writes; omitted content is backward compatible.</summary>
    private static string? ValidateContent(string? description, string? image, SeoInput? seo)
        => description?.Length > Product.MaxDescriptionLength ? "Category description is too long."
            : image?.Length > 500 || (!string.IsNullOrWhiteSpace(image) && !SeoMapping.PublicUrl(image) && !image.StartsWith("/uploads/"))
                ? "Category image must be a public or uploaded image URL." : SeoMapping.Validate(seo);
}
