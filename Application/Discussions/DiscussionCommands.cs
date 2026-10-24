using Domain.Entities;
using Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;
using Application.Auth;

namespace Application.Discussions;

/// <summary>Authenticated product content writes; all authorship and buyer privileges are server-owned.</summary>
public static class DiscussionCommands
{
    /// <summary>A safe write outcome with a machine-readable validation code.</summary>
    public sealed record Result(int Status, string? Error = null, Guid? Id = null);
    /// <summary>Creates or updates only the trusted caller's review.</summary>
    public sealed record SaveReview(Guid ProductId, Guid UserId, string Content, int? Rating) : IRequest<Result>;
    /// <summary>Creates one product question.</summary>
    public sealed record Ask(Guid ProductId, Guid UserId, string Content) : IRequest<Result>;
    /// <summary>Creates one direct answer with server-derived authorship.</summary>
    public sealed record Answer(Guid ProductId, Guid QuestionId, Guid UserId, string Content, bool Official) : IRequest<Result>;
    /// <summary>Changes display visibility without deleting authored content.</summary>
    public sealed record Visibility(string Kind, Guid Id, bool Hidden) : IRequest<Result>;

    /// <summary>Accepts bounded plain text only; HTML is never interpreted by either UI.</summary>
    private static bool Valid(string? text, int max) => !string.IsNullOrWhiteSpace(text) && text.Trim().Length <= max
        && !text.Any(c => char.IsControl(c) && c is not '\n' and not '\r' and not '\t');

    /// <summary>Checks active product visibility and that the authenticated identity still exists.</summary>
    private static async Task<bool> Exists(AppDbContext db, Guid product, Guid user, CancellationToken ct) =>
        await db.Products.AnyAsync(p => p.Id == product && p.Status == ProductStatus.Active, ct) && await db.Users.AnyAsync(u => u.Id == user, ct);

    /// <summary>Validates and persists a customer's unique review.</summary>
    public sealed class ReviewHandler(AppDbContext db) : IRequestHandler<SaveReview, Result>
    {
        /// <summary>Upserts one review; edits retain moderation state, and a unique index arbitrates concurrent inserts.</summary>
        public async Task<Result> Handle(SaveReview request, CancellationToken ct)
        {
            if (!Valid(request.Content, 3000) || request.Rating is < 1 or > 5) return new(400, "INVALID_CONTENT");
            if (!await CustomerProfile.IsCompleteAsync(db, request.UserId, ct)) return new(403, "PROFILE_INCOMPLETE");
            if (!await Exists(db, request.ProductId, request.UserId, ct)) return new(404, "NOT_FOUND");
            if (request.Rating.HasValue && !await DiscussionQueries.DeliveredPurchases(db).AnyAsync(o => o.UserId == request.UserId && o.Items.Any(i => i.ProductId == request.ProductId), ct)) return new(403, "BUYER_REQUIRED");
            var review = await db.ProductReviews.SingleOrDefaultAsync(r => r.ProductId == request.ProductId && r.UserId == request.UserId, ct);
            if (review is null) { review = new() { ProductId = request.ProductId, UserId = request.UserId }; db.ProductReviews.Add(review); }
            review.Content = request.Content.Trim();
            review.Rating = request.Rating;
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { return new(409, "REVIEW_CONFLICT"); }
            return new(200, Id: review.Id);
        }
    }

    /// <summary>Validates and publishes questions.</summary>
    public sealed class AskHandler(AppDbContext db) : IRequestHandler<Ask, Result>
    {
        /// <summary>Publishes an authenticated, plain-text question immediately.</summary>
        public async Task<Result> Handle(Ask request, CancellationToken ct)
        {
            if (!Valid(request.Content, 2000)) return new(400, "INVALID_CONTENT");
            if (!await CustomerProfile.IsCompleteAsync(db, request.UserId, ct)) return new(403, "PROFILE_INCOMPLETE");
            if (!await Exists(db, request.ProductId, request.UserId, ct)) return new(404, "NOT_FOUND");
            var question = new ProductQuestion { ProductId = request.ProductId, UserId = request.UserId, Content = request.Content.Trim() };
            db.ProductQuestions.Add(question);
            await db.SaveChangesAsync(ct);
            return new(201, Id: question.Id);
        }
    }

    /// <summary>Validates and publishes direct answers.</summary>
    public sealed class AnswerHandler(AppDbContext db) : IRequestHandler<Answer, Result>
    {
        /// <summary>Answers a visible question only; the controller supplies official status from a trusted role claim.</summary>
        public async Task<Result> Handle(Answer request, CancellationToken ct)
        {
            if (!Valid(request.Content, 3000)) return new(400, "INVALID_CONTENT");
            if (!request.Official && !await CustomerProfile.IsCompleteAsync(db, request.UserId, ct)) return new(403, "PROFILE_INCOMPLETE");
            if (!await Exists(db, request.ProductId, request.UserId, ct) || !await db.ProductQuestions.AnyAsync(q => q.Id == request.QuestionId && q.ProductId == request.ProductId && !q.IsHidden, ct)) return new(404, "NOT_FOUND");
            var answer = new ProductAnswer { QuestionId = request.QuestionId, UserId = request.UserId, Content = request.Content.Trim(), IsOfficial = request.Official };
            db.ProductAnswers.Add(answer);
            await db.SaveChangesAsync(ct);
            return new(201, Id: answer.Id);
        }
    }

    /// <summary>Persists moderator-controlled visibility.</summary>
    public sealed class VisibilityHandler(AppDbContext db) : IRequestHandler<Visibility, Result>
    {
        /// <summary>Changes visibility without deleting content or changing the author's text.</summary>
        public async Task<Result> Handle(Visibility request, CancellationToken ct)
        {
            switch (request.Kind)
            {
                case "review": var review = await db.ProductReviews.FindAsync([request.Id], ct); if (review is null) return new(404); review.IsHidden = request.Hidden; break;
                case "question": var question = await db.ProductQuestions.FindAsync([request.Id], ct); if (question is null) return new(404); question.IsHidden = request.Hidden; break;
                case "answer": var answer = await db.ProductAnswers.FindAsync([request.Id], ct); if (answer is null) return new(404); answer.IsHidden = request.Hidden; break;
                default: return new(400, "INVALID_KIND");
            }
            await db.SaveChangesAsync(ct);
            return new(200, Id: request.Id);
        }
    }
}
