using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Discussions;

/// <summary>Privacy-safe, paginated product discussion reads and a single authoritative purchase policy.</summary>
public static class DiscussionQueries
{
    /// <summary>Public entry fields, deliberately excluding user IDs and private contact details.</summary>
    public sealed record Entry
    {
        public Guid Id { get; init; }
        public Guid ProductId { get; init; }
        public string ProductTitle { get; init; } = "";
        public string Kind { get; init; } = "";
        public Guid? QuestionId { get; init; }
        public string AuthorName { get; init; } = "";
        public string Content { get; init; } = "";
        public int? Rating { get; init; }
        public bool IsBuyer { get; init; }
        public bool IsOfficial { get; init; }
        public bool IsHidden { get; init; }
        public DateTime CreatedAtUtc { get; init; }
    }
    /// <summary>A bounded result with stable page metadata.</summary>
    public sealed record Page(IReadOnlyList<Entry> Items, int Total, int PageNumber, int PageSize);
    /// <summary>Independent public review count and qualifying rating aggregate.</summary>
    public sealed record Summary(double Rating, int RatingCount, int ReviewCount);
    /// <summary>Private current-author state and purchase-derived permission.</summary>
    public sealed record Mine(bool CanRate, Entry? Review);
    /// <summary>Reads public content for one active product.</summary>
    public sealed record List(Guid ProductId, string Kind = "review", Guid? QuestionId = null, int Page = 1) : IRequest<Page?>;
    /// <summary>Reads the current account's own review.</summary>
    public sealed record MyReview(Guid ProductId, Guid UserId) : IRequest<Mine?>;
    /// <summary>Filters the moderator's visible and hidden content queue.</summary>
    public sealed record AdminList(string? Kind = null, Guid? ProductId = null, bool? Hidden = null, int Page = 1) : IRequest<Page>;

    /// <summary>Only an authenticated account's verified, delivered order grants buyer privileges.</summary>
    public static IQueryable<Order> DeliveredPurchases(AppDbContext db) => db.Orders.AsNoTracking()
        .Where(o => o.Status == OrderStatus.Delivered && o.PaymentStatus == PaymentStatus.Verified);

    /// <summary>Builds the public review projection without leaking account or order identifiers.</summary>
    public static IQueryable<Entry> Reviews(AppDbContext db)
    {
        var purchases = DeliveredPurchases(db);
        return from r in db.ProductReviews.AsNoTracking()
        join u in db.Users on r.UserId equals u.Id
        join p in db.Products on r.ProductId equals p.Id
        let buyer = purchases.Any(o => o.UserId == r.UserId && o.Items.Any(i => i.ProductId == r.ProductId))
        select new Entry { Id = r.Id, ProductId = r.ProductId, ProductTitle = p.Title, Kind = "review", AuthorName = u.FullName,
            Content = r.Content, Rating = buyer ? r.Rating : null, IsBuyer = buyer, IsHidden = r.IsHidden, CreatedAtUtc = r.CreatedAtUtc };
    }

    /// <summary>Builds a question projection; questions never grant or imply a purchase.</summary>
    public static IQueryable<Entry> Questions(AppDbContext db) =>
        from q in db.ProductQuestions.AsNoTracking()
        join u in db.Users on q.UserId equals u.Id
        join p in db.Products on q.ProductId equals p.Id
        select new Entry { Id = q.Id, ProductId = q.ProductId, ProductTitle = p.Title, Kind = "question", AuthorName = u.FullName,
            Content = q.Content, IsHidden = q.IsHidden, CreatedAtUtc = q.CreatedAtUtc };

    /// <summary>Builds direct answers, optionally suppressing an entire hidden question thread.</summary>
    public static IQueryable<Entry> Answers(AppDbContext db, bool publicOnly = false) =>
        from a in db.ProductAnswers.AsNoTracking()
        join q in db.ProductQuestions on a.QuestionId equals q.Id
        join u in db.Users on a.UserId equals u.Id
        join p in db.Products on q.ProductId equals p.Id
        where !publicOnly || !q.IsHidden
        select new Entry { Id = a.Id, ProductId = q.ProductId, ProductTitle = p.Title, Kind = "answer", QuestionId = a.QuestionId,
            AuthorName = u.FullName, Content = a.Content, IsOfficial = a.IsOfficial, IsHidden = a.IsHidden, CreatedAtUtc = a.CreatedAtUtc };

    /// <summary>Aggregates reviews in one database query for a catalog batch, never one query per card.</summary>
    public static async Task<Dictionary<Guid, Summary>> Summaries(AppDbContext db, IReadOnlyList<Guid> ids, CancellationToken ct)
    {
        var purchases = DeliveredPurchases(db);
        var rows = await db.ProductReviews.AsNoTracking().Where(r => ids.Contains(r.ProductId) && !r.IsHidden)
            .Select(r => new { r.ProductId, Rating = purchases.Any(o => o.UserId == r.UserId && o.Items.Any(i => i.ProductId == r.ProductId)) ? r.Rating : null })
            .GroupBy(r => r.ProductId).Select(g => new { Id = g.Key, ReviewCount = g.Count(), RatingCount = g.Count(r => r.Rating != null), Average = g.Average(r => (double?)r.Rating) })
            .ToListAsync(ct);
        return rows.ToDictionary(r => r.Id, r => new Summary(Math.Round(r.Average ?? 0, 1), r.RatingCount, r.ReviewCount));
    }

    /// <summary>Returns a stable, bounded discussion page.</summary>
    private static async Task<Page> Paginate(IQueryable<Entry> query, int page, CancellationToken ct)
    {
        const int size = 10;
        var total = await query.CountAsync(ct);
        page = Math.Clamp(page, 1, Math.Max(1, (total + size - 1) / size));
        return new(await query.OrderByDescending(x => x.CreatedAtUtc).ThenByDescending(x => x.Id)
            .Skip((page - 1) * size).Take(size).ToListAsync(ct), total, page, size);
    }

    /// <summary>Handles public paginated reads.</summary>
    public sealed class ListHandler(AppDbContext db) : IRequestHandler<List, Page?>
    {
        /// <summary>Reads only visible content belonging to an active product and its visible question.</summary>
        public async Task<Page?> Handle(List request, CancellationToken ct)
        {
            if (!await db.Products.AnyAsync(p => p.Id == request.ProductId && p.Status == ProductStatus.Active, ct)) return null;
            if (request.Kind == "answer" && !await db.ProductQuestions.AnyAsync(q => q.Id == request.QuestionId && q.ProductId == request.ProductId && !q.IsHidden, ct)) return null;
            var query = request.Kind switch { "question" => Questions(db), "answer" => Answers(db, true).Where(x => x.QuestionId == request.QuestionId), _ => Reviews(db) };
            return await Paginate(query.Where(x => x.ProductId == request.ProductId && !x.IsHidden), request.Page, ct);
        }
    }

    /// <summary>Handles private review and eligibility reads.</summary>
    public sealed class MineHandler(AppDbContext db) : IRequestHandler<MyReview, Mine?>
    {
        /// <summary>Returns the caller's own review, including moderation state, and server-derived eligibility.</summary>
        public async Task<Mine?> Handle(MyReview request, CancellationToken ct)
        {
            if (!await db.Products.AnyAsync(p => p.Id == request.ProductId && p.Status == ProductStatus.Active, ct)) return null;
            var id = await db.ProductReviews.Where(r => r.ProductId == request.ProductId && r.UserId == request.UserId).Select(r => (Guid?)r.Id).SingleOrDefaultAsync(ct);
            return new(await DeliveredPurchases(db).AnyAsync(o => o.UserId == request.UserId && o.Items.Any(i => i.ProductId == request.ProductId), ct),
                id.HasValue ? await Reviews(db).SingleAsync(x => x.Id == id, ct) : null);
        }
    }

    /// <summary>Handles the protected moderation queue.</summary>
    public sealed class AdminHandler(AppDbContext db) : IRequestHandler<AdminList, Page>
    {
        /// <summary>Pages one content type at a time so moderation never loads a full catalog or thread.</summary>
        public async Task<Page> Handle(AdminList request, CancellationToken ct)
        {
            var query = request.Kind switch { "question" => Questions(db), "answer" => Answers(db), _ => Reviews(db) };
            if (request.ProductId.HasValue) query = query.Where(x => x.ProductId == request.ProductId);
            if (request.Hidden.HasValue) query = query.Where(x => x.IsHidden == request.Hidden);
            return await Paginate(query, request.Page, ct);
        }
    }
}
