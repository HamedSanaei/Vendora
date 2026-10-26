using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Auth;

/// <summary>Checks current account facts after JWT signature verification, preserving legacy sessions until explicit revocation.</summary>
public static class SessionValidation
{
    public sealed record Query(Guid UserId,string? Stamp) : IRequest<bool>;
    public sealed class Handler(AppDbContext db,TimeProvider time) : IRequestHandler<Query,bool>
    {
        /// <inheritdoc />
        public async Task<bool> Handle(Query request,CancellationToken ct)
        {
            var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.UserId,ct);
            return user is not null && !(user.LockoutEnd > time.GetUtcNow()) &&
                (request.Stamp is not null ? request.Stamp == (user.SecurityStamp ?? "") : user.TokensRevokedAtUtc is null);
        }
    }
}
