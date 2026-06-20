using Application.Admin.DTOs;
using Domain.Entities;
using MediatR;
using Persistence.Admin;
using Persistence.Common;

namespace Application.Admin;

/// <summary>
/// Coupon admin use cases.
/// </summary>
public static class Coupons
{
    /// <summary>Lists coupons.</summary>
    public static class List
    {
        /// <summary>Represents the list coupons query.</summary>
        public sealed record Query(bool IncludeInactive = true) : IRequest<IReadOnlyList<AdminCouponDto>>;

        /// <summary>Handles list coupon queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<AdminCouponDto>>
        {
            private readonly IAdminRepository _repository;

            /// <summary>Creates the handler.</summary>
            public Handler(IAdminRepository repository) => _repository = repository;

            /// <inheritdoc />
            public async Task<IReadOnlyList<AdminCouponDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var coupons = await _repository.GetCouponsAsync(request.IncludeInactive, cancellationToken);
                return coupons.Select(AdminMappings.MapCoupon).ToList();
            }
        }
    }

    /// <summary>Creates a coupon.</summary>
    public static class Create
    {
        /// <summary>Represents the create coupon command.</summary>
        public sealed record Command(
            string Title,
            string Code,
            decimal DiscountPercent,
            decimal? MaxDiscountAmount,
            DateTime ExpiresAtUtc,
            bool IsActive,
            bool AppliesToAllCategories,
            IReadOnlyList<Guid> CategoryIds) : IRequest<Result>;

        /// <summary>Represents the command result.</summary>
        public sealed record Result(AdminActionResult Action, AdminCouponDto? Coupon);

        /// <summary>Handles create coupon commands.</summary>
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
                var validation = await ValidateAsync(
                    new CouponValidationRequest(
                        request.Title,
                        request.Code,
                        request.DiscountPercent,
                        request.MaxDiscountAmount,
                        request.AppliesToAllCategories,
                        request.CategoryIds),
                    null,
                    _repository,
                    cancellationToken);
                if (validation is not null)
                {
                    return Fail(validation);
                }

                var coupon = new Coupon
                {
                    Title = request.Title.Trim(),
                    Code = NormalizeCode(request.Code),
                    DiscountPercent = request.DiscountPercent,
                    MaxDiscountAmount = request.MaxDiscountAmount,
                    ExpiresAtUtc = request.ExpiresAtUtc,
                    IsActive = request.IsActive,
                    AppliesToAllCategories = request.AppliesToAllCategories
                };

                if (!coupon.AppliesToAllCategories)
                {
                    coupon.Categories = request.CategoryIds.Distinct().Select(categoryId => new CouponCategory
                    {
                        CouponId = coupon.Id,
                        CategoryId = categoryId
                    }).ToList();
                }

                await _repository.AddCouponAsync(coupon, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                var saved = await _repository.GetCouponAsync(coupon.Id, trackChanges: false, cancellationToken);
                return new Result(AdminActionResult.Ok(), AdminMappings.MapCoupon(saved ?? coupon));
            }

            private static Result Fail(string error) => new(AdminActionResult.Fail(error), null);
        }
    }

    /// <summary>Updates a coupon.</summary>
    public static class Edit
    {
        /// <summary>Represents the edit coupon command.</summary>
        public sealed record Command(
            Guid Id,
            string Title,
            string Code,
            decimal DiscountPercent,
            decimal? MaxDiscountAmount,
            DateTime ExpiresAtUtc,
            bool IsActive,
            bool AppliesToAllCategories,
            IReadOnlyList<Guid> CategoryIds) : IRequest<Result>;

        /// <summary>Represents the command result.</summary>
        public sealed record Result(AdminActionResult Action, AdminCouponDto? Coupon);

        /// <summary>Handles edit coupon commands.</summary>
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
                var coupon = await _repository.GetCouponAsync(request.Id, trackChanges: true, cancellationToken);
                if (coupon is null)
                {
                    return Fail("Coupon was not found.");
                }

                var validation = await ValidateAsync(
                    new CouponValidationRequest(
                        request.Title,
                        request.Code,
                        request.DiscountPercent,
                        request.MaxDiscountAmount,
                        request.AppliesToAllCategories,
                        request.CategoryIds),
                    request.Id,
                    _repository,
                    cancellationToken);
                if (validation is not null)
                {
                    return Fail(validation);
                }

                coupon.Title = request.Title.Trim();
                coupon.Code = NormalizeCode(request.Code);
                coupon.DiscountPercent = request.DiscountPercent;
                coupon.MaxDiscountAmount = request.MaxDiscountAmount;
                coupon.ExpiresAtUtc = request.ExpiresAtUtc;
                coupon.IsActive = request.IsActive;
                coupon.AppliesToAllCategories = request.AppliesToAllCategories;

                _repository.RemoveCouponCategories(coupon);
                if (!coupon.AppliesToAllCategories)
                {
                    coupon.Categories = request.CategoryIds.Distinct().Select(categoryId => new CouponCategory
                    {
                        CouponId = coupon.Id,
                        CategoryId = categoryId
                    }).ToList();
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);
                var saved = await _repository.GetCouponAsync(coupon.Id, trackChanges: false, cancellationToken);
                return new Result(AdminActionResult.Ok(), AdminMappings.MapCoupon(saved ?? coupon));
            }

            private static Result Fail(string error) => new(AdminActionResult.Fail(error), null);
        }
    }

    /// <summary>Soft deletes a coupon.</summary>
    public static class Delete
    {
        /// <summary>Represents the delete coupon command.</summary>
        public sealed record Command(Guid Id) : IRequest<AdminActionResult>;

        /// <summary>Handles delete coupon commands.</summary>
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
                var coupon = await _repository.GetCouponAsync(request.Id, trackChanges: true, cancellationToken);
                if (coupon is null)
                {
                    return AdminActionResult.Fail("Coupon was not found.");
                }

                coupon.IsActive = false;
                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return AdminActionResult.Ok();
            }
        }
    }

    private sealed record CouponValidationRequest(
        string Title,
        string Code,
        decimal DiscountPercent,
        decimal? MaxDiscountAmount,
        bool AppliesToAllCategories,
        IReadOnlyList<Guid> CategoryIds);

    private static async Task<string?> ValidateAsync(
        CouponValidationRequest request,
        Guid? ignoredId,
        IAdminRepository repository,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return "Coupon title is required.";
        }

        string code = NormalizeCode(request.Code);
        if (string.IsNullOrWhiteSpace(code))
        {
            return "Coupon code is required.";
        }

        if (request.DiscountPercent <= 0 || request.DiscountPercent > 100)
        {
            return "Discount percent must be between 1 and 100.";
        }

        if (request.MaxDiscountAmount is decimal maxDiscountAmount && maxDiscountAmount < 0)
        {
            return "Maximum discount amount cannot be negative.";
        }

        if (!request.AppliesToAllCategories && request.CategoryIds.Count == 0)
        {
            return "Select at least one category or apply the coupon to all categories.";
        }

        if (await repository.CouponCodeExistsAsync(code, ignoredId, cancellationToken))
        {
            return "A coupon with this code already exists.";
        }

        if (!request.AppliesToAllCategories && !await repository.CategoriesExistAsync(request.CategoryIds, cancellationToken))
        {
            return "One or more selected categories do not exist.";
        }

        return null;
    }

    private static string NormalizeCode(string? code)
    {
        return string.IsNullOrWhiteSpace(code) ? string.Empty : code.Trim().ToUpperInvariant();
    }
}
