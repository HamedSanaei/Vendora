using Application.Admin.DTOs;
using Domain.Common;
using Domain.Entities;
using MediatR;
using Persistence.Admin;
using Persistence.Common;

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

            /// <summary>Creates the handler.</summary>
            public Handler(IAdminRepository repository)
            {
                _repository = repository;
            }

            /// <inheritdoc />
            public async Task<IReadOnlyList<AdminCategoryDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var categories = await _repository.GetCategoriesAsync(request.IncludeInactive, cancellationToken);
                return categories.Select(AdminMappings.MapCategory).ToList();
            }
        }
    }

    /// <summary>Creates a category.</summary>
    public static class Create
    {
        /// <summary>Represents the create category command.</summary>
        public sealed record Command(string Name, string? Slug, Guid? ParentCategoryId, bool IsActive) : IRequest<Result>;

        /// <summary>Represents the create result.</summary>
        public sealed record Result(AdminActionResult Action, AdminCategoryDto? Category);

        /// <summary>Handles create category commands.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
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
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
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
        public sealed record Command(Guid Id, string Name, string? Slug, Guid? ParentCategoryId, bool IsActive) : IRequest<Result>;

        /// <summary>Represents the edit result.</summary>
        public sealed record Result(AdminActionResult Action, AdminCategoryDto? Category);

        /// <summary>Handles edit category commands.</summary>
        public sealed class Handler : IRequestHandler<Command, Result>
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
            public async Task<Result> Handle(Command request, CancellationToken cancellationToken)
            {
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

                category.Name = name;
                category.Slug = slug;
                category.ParentCategoryId = request.ParentCategoryId;
                category.IsActive = request.IsActive;
                await _unitOfWork.SaveChangesAsync(cancellationToken);

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
}
