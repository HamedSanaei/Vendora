using Application.Admin.DTOs;
using Domain.Common;
using Domain.Entities;
using MediatR;
using Persistence.Admin;
using Persistence.Common;

namespace Application.Admin;

/// <summary>
/// Brand admin use cases.
/// </summary>
public static class Brands
{
    /// <summary>Lists brands.</summary>
    public static class List
    {
        /// <summary>Represents the list brands query.</summary>
        public sealed record Query(bool IncludeInactive = true) : IRequest<IReadOnlyList<AdminBrandDto>>;

        /// <summary>Handles list brands queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<AdminBrandDto>>
        {
            private readonly IAdminRepository _repository;

            /// <summary>Creates the handler.</summary>
            public Handler(IAdminRepository repository) => _repository = repository;

            /// <inheritdoc />
            public async Task<IReadOnlyList<AdminBrandDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var brands = await _repository.GetBrandsAsync(request.IncludeInactive, cancellationToken);
                return brands.Select(AdminMappings.MapBrand).ToList();
            }
        }
    }

    /// <summary>Creates a brand.</summary>
    public static class Create
    {
        /// <summary>Represents the create brand command.</summary>
        public sealed record Command(
            string Name,
            string? Slug,
            string? LogoUrl,
            string? Email,
            string? Website,
            string? Description,
            string? Location,
            bool IsActive) : IRequest<Result>;

        /// <summary>Represents the command result.</summary>
        public sealed record Result(AdminActionResult Action, AdminBrandDto? Brand);

        /// <summary>Handles create brand commands.</summary>
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
                var validation = await ValidateAsync(request.Name, request.Slug, null, _repository, cancellationToken);
                if (validation.Error is not null)
                {
                    return Fail(validation.Error);
                }

                var brand = new Brand
                {
                    Name = validation.Name,
                    Slug = validation.Slug,
                    LogoUrl = NormalizeOptional(request.LogoUrl),
                    Email = NormalizeOptional(request.Email),
                    Website = NormalizeOptional(request.Website),
                    Description = NormalizeOptional(request.Description),
                    Location = NormalizeOptional(request.Location),
                    IsActive = request.IsActive
                };

                await _repository.AddBrandAsync(brand, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return new Result(AdminActionResult.Ok(), AdminMappings.MapBrand(brand));
            }

            private static Result Fail(string error) => new(AdminActionResult.Fail(error), null);
        }
    }

    /// <summary>Updates a brand.</summary>
    public static class Edit
    {
        /// <summary>Represents the edit brand command.</summary>
        public sealed record Command(
            Guid Id,
            string Name,
            string? Slug,
            string? LogoUrl,
            string? Email,
            string? Website,
            string? Description,
            string? Location,
            bool IsActive) : IRequest<Result>;

        /// <summary>Represents the command result.</summary>
        public sealed record Result(AdminActionResult Action, AdminBrandDto? Brand);

        /// <summary>Handles edit brand commands.</summary>
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
                var brand = await _repository.GetBrandAsync(request.Id, trackChanges: true, cancellationToken);
                if (brand is null)
                {
                    return Fail("Brand was not found.");
                }

                var validation = await ValidateAsync(request.Name, request.Slug, request.Id, _repository, cancellationToken);
                if (validation.Error is not null)
                {
                    return Fail(validation.Error);
                }

                brand.Name = validation.Name;
                brand.Slug = validation.Slug;
                brand.LogoUrl = NormalizeOptional(request.LogoUrl);
                brand.Email = NormalizeOptional(request.Email);
                brand.Website = NormalizeOptional(request.Website);
                brand.Description = NormalizeOptional(request.Description);
                brand.Location = NormalizeOptional(request.Location);
                brand.IsActive = request.IsActive;

                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return new Result(AdminActionResult.Ok(), AdminMappings.MapBrand(brand));
            }

            private static Result Fail(string error) => new(AdminActionResult.Fail(error), null);
        }
    }

    /// <summary>Soft deletes a brand.</summary>
    public static class Delete
    {
        /// <summary>Represents the delete brand command.</summary>
        public sealed record Command(Guid Id) : IRequest<AdminActionResult>;

        /// <summary>Handles delete brand commands.</summary>
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
                var brand = await _repository.GetBrandAsync(request.Id, trackChanges: true, cancellationToken);
                if (brand is null)
                {
                    return AdminActionResult.Fail("Brand was not found.");
                }

                brand.IsActive = false;
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return AdminActionResult.Ok();
            }
        }
    }

    private static async Task<(string Name, string Slug, string? Error)> ValidateAsync(
        string name,
        string? slug,
        Guid? ignoredId,
        IAdminRepository repository,
        CancellationToken cancellationToken)
    {
        string normalizedName = name.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return (normalizedName, string.Empty, "Brand name is required.");
        }

        string normalizedSlug = SlugHelper.ToSlug(string.IsNullOrWhiteSpace(slug) ? normalizedName : slug);
        if (string.IsNullOrWhiteSpace(normalizedSlug))
        {
            return (normalizedName, normalizedSlug, "Brand slug could not be generated.");
        }

        if (await repository.BrandSlugExistsAsync(normalizedSlug, ignoredId, cancellationToken))
        {
            return (normalizedName, normalizedSlug, "A brand with this slug already exists.");
        }

        return (normalizedName, normalizedSlug, null);
    }

    private static string? NormalizeOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
