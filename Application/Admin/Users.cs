using Application.Admin.DTOs;
using Domain.Enums;
using MediatR;
using Persistence.Admin;
using Persistence.Common;

namespace Application.Admin;

/// <summary>
/// User admin use cases.
/// </summary>
public static class Users
{
    /// <summary>Lists users.</summary>
    public static class List
    {
        /// <summary>Represents the list users query.</summary>
        public sealed record Query : IRequest<IReadOnlyList<AdminUserDto>>;

        /// <summary>Handles list users queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<AdminUserDto>>
        {
            private readonly IAdminRepository _repository;

            /// <summary>Creates the handler.</summary>
            public Handler(IAdminRepository repository) => _repository = repository;

            /// <inheritdoc />
            public async Task<IReadOnlyList<AdminUserDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var users = await _repository.GetUsersAsync(cancellationToken);
                return users.Select(AdminMappings.MapUser).ToList();
            }
        }
    }

    /// <summary>Returns one user.</summary>
    public static class Details
    {
        /// <summary>Represents the details query.</summary>
        public sealed record Query(Guid Id) : IRequest<AdminUserDto?>;

        /// <summary>Handles details queries.</summary>
        public sealed class Handler : IRequestHandler<Query, AdminUserDto?>
        {
            private readonly IAdminRepository _repository;

            /// <summary>Creates the handler.</summary>
            public Handler(IAdminRepository repository) => _repository = repository;

            /// <inheritdoc />
            public async Task<AdminUserDto?> Handle(Query request, CancellationToken cancellationToken)
            {
                var user = await _repository.GetUserAsync(request.Id, trackChanges: false, cancellationToken);
                return user is null ? null : AdminMappings.MapUser(user);
            }
        }
    }

    /// <summary>Updates a user account.</summary>
    public static class Edit
    {
        /// <summary>Represents the edit user command.</summary>
        public sealed record Command(Guid Id, string FullName, string Email, string? PhoneNumber, UserRole Role) : IRequest<Result>;

        /// <summary>Represents the edit result.</summary>
        public sealed record Result(AdminActionResult Action, AdminUserDto? User);

        /// <summary>Handles edit user commands.</summary>
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
                var user = await _repository.GetUserAsync(request.Id, trackChanges: true, cancellationToken);
                if (user is null)
                {
                    return Fail("User was not found.");
                }

                string fullName = request.FullName.Trim();
                string email = request.Email.Trim().ToLowerInvariant();
                if (string.IsNullOrWhiteSpace(fullName))
                {
                    return Fail("Full name is required.");
                }

                if (string.IsNullOrWhiteSpace(email) || !email.Contains('@', StringComparison.Ordinal))
                {
                    return Fail("A valid email is required.");
                }

                if (await _repository.UserEmailExistsAsync(email, request.Id, cancellationToken))
                {
                    return Fail("Another user already uses this email.");
                }

                user.FullName = fullName;
                user.Email = email;
                user.PhoneNumber = string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim();
                user.Role = request.Role;

                await _unitOfWork.SaveChangesAsync(cancellationToken);
                return new Result(AdminActionResult.Ok(), AdminMappings.MapUser(user));
            }

            private static Result Fail(string error) => new(AdminActionResult.Fail(error), null);
        }
    }

    /// <summary>Represents a safe placeholder password reset action.</summary>
    public static class RequestPasswordReset
    {
        /// <summary>Represents the reset command.</summary>
        public sealed record Command(Guid Id) : IRequest<AdminActionResult>;

        /// <summary>Handles reset commands without mutating password data until auth is implemented.</summary>
        public sealed class Handler : IRequestHandler<Command, AdminActionResult>
        {
            private readonly IAdminRepository _repository;

            /// <summary>Creates the handler.</summary>
            public Handler(IAdminRepository repository) => _repository = repository;

            /// <inheritdoc />
            public async Task<AdminActionResult> Handle(Command request, CancellationToken cancellationToken)
            {
                var user = await _repository.GetUserAsync(request.Id, trackChanges: false, cancellationToken);
                return user is null
                    ? AdminActionResult.Fail("User was not found.")
                    : AdminActionResult.Fail("Password reset requires a real auth provider and is not configured yet.");
            }
        }
    }
}
