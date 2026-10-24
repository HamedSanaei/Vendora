using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.StoreSettings;

/// <summary>Manages one store-wide presentation switch without deleting, resetting or revaluing seeded data.</summary>
public static class SeedDisplayUseCases
{
    public sealed record State(bool ShowSeedData);
    public sealed record Query : IRequest<State>;
    public sealed record Set(bool ShowSeedData) : IRequest<State>;

    /// <summary>Reads the current switch with backward-compatible visible defaults when no settings row exists.</summary>
    public sealed class QueryHandler(AppDbContext db) : IRequestHandler<Query, State>
    {
        public async Task<State> Handle(Query request, CancellationToken ct)
            => new(!await db.SeoSettings.AsNoTracking().AnyAsync(x => x.HideSeedData, ct));
    }

    /// <summary>Saves the explicit target state; repeating the same request has no additional side effects.</summary>
    public sealed class SetHandler(AppDbContext db) : IRequestHandler<Set, State>
    {
        public async Task<State> Handle(Set request, CancellationToken ct)
        {
            var settings = await db.SeoSettings.SingleOrDefaultAsync(ct);
            if (settings is null) { settings = new SeoSettings(); db.SeoSettings.Add(settings); }
            settings.HideSeedData = !request.ShowSeedData;
            await db.SaveChangesAsync(ct);
            return new(request.ShowSeedData);
        }
    }
}
