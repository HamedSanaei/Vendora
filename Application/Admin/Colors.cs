using Application.Admin.DTOs;
using Domain.Common;
using Domain.Entities;
using MediatR;
using Persistence.Admin;
using Persistence.Common;

namespace Application.Admin;

/// <summary>
/// Color admin use cases.
/// </summary>
public static class Colors
{
    /// <summary>Lists colors.</summary>
    public static class List
    {
        /// <summary>Represents the list colors query.</summary>
        public sealed record Query(bool IncludeInactive = true) : IRequest<IReadOnlyList<AdminColorDto>>;

        /// <summary>Handles list colors queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<AdminColorDto>>
        {
            private readonly IAdminRepository _repository;

            /// <summary>Creates the handler.</summary>
            public Handler(IAdminRepository repository) => _repository = repository;

            /// <inheritdoc />
            public async Task<IReadOnlyList<AdminColorDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var colors = await _repository.GetColorsAsync(request.IncludeInactive, cancellationToken);
                return colors.Select(AdminMappings.MapColor).ToList();
            }
        }
    }

    /// <summary>Creates a color.</summary>
    public static class Create
    {
        /// <summary>Represents the create color command.</summary>
        public sealed record Command(string Name, string? Slug, string? HexCode, bool IsActive) : IRequest<Result>;

        /// <summary>Represents the command result.</summary>
        public sealed record Result(AdminActionResult Action, AdminColorDto? Color);

        /// <summary>Handles create color commands.</summary>
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
                var validation = await ValidateAsync(request.Name, request.Slug, request.HexCode, null, _repository, cancellationToken);
                if (validation.Error is not null)
                {
                    return Fail(validation.Error);
                }

                var color = new CatalogColor
                {
                    Name = validation.Name,
                    Slug = validation.Slug,
                    HexCode = validation.HexCode,
                    IsActive = request.IsActive
                };

                await _repository.AddColorAsync(color, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return new Result(AdminActionResult.Ok(), AdminMappings.MapColor(color));
            }

            private static Result Fail(string error) => new(AdminActionResult.Fail(error), null);
        }
    }

    /// <summary>Updates a color.</summary>
    public static class Edit
    {
        /// <summary>Represents the edit color command.</summary>
        public sealed record Command(Guid Id, string Name, string? Slug, string? HexCode, bool IsActive) : IRequest<Result>;

        /// <summary>Represents the command result.</summary>
        public sealed record Result(AdminActionResult Action, AdminColorDto? Color);

        /// <summary>Handles edit color commands.</summary>
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
                var color = await _repository.GetColorAsync(request.Id, trackChanges: true, cancellationToken);
                if (color is null)
                {
                    return Fail("Color was not found.");
                }

                var validation = await ValidateAsync(request.Name, request.Slug, request.HexCode, request.Id, _repository, cancellationToken);
                if (validation.Error is not null)
                {
                    return Fail(validation.Error);
                }

                color.Name = validation.Name;
                color.Slug = validation.Slug;
                color.HexCode = validation.HexCode;
                color.IsActive = request.IsActive;

                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return new Result(AdminActionResult.Ok(), AdminMappings.MapColor(color));
            }

            private static Result Fail(string error) => new(AdminActionResult.Fail(error), null);
        }
    }

    /// <summary>Soft deletes a color.</summary>
    public static class Delete
    {
        /// <summary>Represents the delete color command.</summary>
        public sealed record Command(Guid Id) : IRequest<AdminActionResult>;

        /// <summary>Handles delete color commands.</summary>
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
                var color = await _repository.GetColorAsync(request.Id, trackChanges: true, cancellationToken);
                if (color is null)
                {
                    return AdminActionResult.Fail("Color was not found.");
                }

                color.IsActive = false;
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return AdminActionResult.Ok();
            }
        }
    }

    private static async Task<(string Name, string Slug, string? HexCode, string? Error)> ValidateAsync(
        string name,
        string? slug,
        string? hexCode,
        Guid? ignoredId,
        IAdminRepository repository,
        CancellationToken cancellationToken)
    {
        string normalizedName = name.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return (normalizedName, string.Empty, null, "Color name is required.");
        }

        string normalizedSlug = SlugHelper.ToSlug(string.IsNullOrWhiteSpace(slug) ? normalizedName : slug);
        if (string.IsNullOrWhiteSpace(normalizedSlug))
        {
            return (normalizedName, normalizedSlug, null, "Color slug could not be generated.");
        }

        if (await repository.ColorSlugExistsAsync(normalizedSlug, ignoredId, cancellationToken))
        {
            return (normalizedName, normalizedSlug, null, "A color with this slug already exists.");
        }

        string? normalizedHexCode = NormalizeHexCode(hexCode);
        if (normalizedHexCode is not null && !IsValidHexCode(normalizedHexCode))
        {
            return (normalizedName, normalizedSlug, normalizedHexCode, "Color hex code must look like #0F172A.");
        }

        return (normalizedName, normalizedSlug, normalizedHexCode, null);
    }

    private static string? NormalizeHexCode(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static bool IsValidHexCode(string value)
    {
        if (value.Length is not 4 and not 7 || value[0] != '#')
        {
            return false;
        }

        return value.Skip(1).All(Uri.IsHexDigit);
    }
}
