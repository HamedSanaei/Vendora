using System.Net.Mail;
using System.Text;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Persistence;

namespace Application.Newsletter;

/// <summary>
/// Newsletter email subscription use cases.
/// </summary>
public static class NewsletterSubscriptions
{
    /// <summary>Represents one newsletter subscriber row.</summary>
    public sealed record NewsletterSubscriptionDto(
        Guid Id,
        string Email,
        string? SourceLocale,
        bool IsActive,
        DateTime CreatedAtUtc,
        DateTime? UpdatedAtUtc);

    /// <summary>Represents a mutation result for newsletter subscription operations.</summary>
    public sealed record SubscriptionResult(bool Succeeded, string Message, NewsletterSubscriptionDto? Subscription);

    /// <summary>Subscribes an email from the storefront call-to-action.</summary>
    public static class Subscribe
    {
        /// <summary>Represents a subscribe command.</summary>
        public sealed record Command(string Email, string? Locale) : IRequest<SubscriptionResult>;

        /// <summary>Handles newsletter subscribe commands.</summary>
        public sealed class Handler : IRequestHandler<Command, SubscriptionResult>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<SubscriptionResult> Handle(Command request, CancellationToken cancellationToken)
            {
                string? normalizedEmail = NormalizeEmail(request.Email);
                if (normalizedEmail is null)
                {
                    return new SubscriptionResult(false, "A valid email address is required.", null);
                }

                string? locale = NormalizeLocale(request.Locale);
                var existing = await _dbContext.EmailSubscriptions
                    .SingleOrDefaultAsync(subscription => subscription.Email == normalizedEmail, cancellationToken);

                if (existing is not null)
                {
                    if (!existing.IsActive || existing.SourceLocale != locale)
                    {
                        existing.IsActive = true;
                        existing.SourceLocale = locale ?? existing.SourceLocale;
                        await _dbContext.SaveChangesAsync(cancellationToken);
                    }

                    return new SubscriptionResult(true, "This email is already subscribed.", Map(existing));
                }

                var subscription = new EmailSubscription
                {
                    Email = normalizedEmail,
                    SourceLocale = locale,
                    IsActive = true
                };

                await _dbContext.EmailSubscriptions.AddAsync(subscription, cancellationToken);
                await _dbContext.SaveChangesAsync(cancellationToken);

                return new SubscriptionResult(true, "Email subscribed successfully.", Map(subscription));
            }
        }
    }

    /// <summary>Lists newsletter subscriptions for the admin panel.</summary>
    public static class AdminList
    {
        /// <summary>Represents the admin list query.</summary>
        public sealed record Query : IRequest<IReadOnlyList<NewsletterSubscriptionDto>>;

        /// <summary>Handles admin list queries.</summary>
        public sealed class Handler : IRequestHandler<Query, IReadOnlyList<NewsletterSubscriptionDto>>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<IReadOnlyList<NewsletterSubscriptionDto>> Handle(Query request, CancellationToken cancellationToken)
            {
                var subscriptions = await _dbContext.EmailSubscriptions
                    .AsNoTracking()
                    .OrderByDescending(subscription => subscription.CreatedAtUtc)
                    .ToListAsync(cancellationToken);

                return subscriptions.Select(Map).ToList();
            }
        }
    }

    /// <summary>Exports newsletter subscriptions as CSV.</summary>
    public static class ExportCsv
    {
        /// <summary>Represents the CSV export query.</summary>
        public sealed record Query : IRequest<string>;

        /// <summary>Handles CSV export queries.</summary>
        public sealed class Handler : IRequestHandler<Query, string>
        {
            private readonly AppDbContext _dbContext;

            /// <summary>Creates the handler.</summary>
            public Handler(AppDbContext dbContext)
            {
                _dbContext = dbContext;
            }

            /// <inheritdoc />
            public async Task<string> Handle(Query request, CancellationToken cancellationToken)
            {
                var rows = await _dbContext.EmailSubscriptions
                    .AsNoTracking()
                    .OrderByDescending(subscription => subscription.CreatedAtUtc)
                    .Select(subscription => new
                    {
                        subscription.Email,
                        subscription.SourceLocale,
                        subscription.IsActive,
                        subscription.CreatedAtUtc,
                        subscription.UpdatedAtUtc
                    })
                    .ToListAsync(cancellationToken);

                var csv = new StringBuilder();
                csv.AppendLine("email,source_locale,is_active,created_at_utc,updated_at_utc");

                foreach (var row in rows)
                {
                    csv.Append(Csv(row.Email));
                    csv.Append(',');
                    csv.Append(Csv(row.SourceLocale));
                    csv.Append(',');
                    csv.Append(row.IsActive ? "true" : "false");
                    csv.Append(',');
                    csv.Append(Csv(row.CreatedAtUtc.ToString("O")));
                    csv.Append(',');
                    csv.AppendLine(Csv(row.UpdatedAtUtc?.ToString("O")));
                }

                return csv.ToString();
            }
        }
    }

    private static NewsletterSubscriptionDto Map(EmailSubscription subscription)
    {
        return new NewsletterSubscriptionDto(
            subscription.Id,
            subscription.Email,
            subscription.SourceLocale,
            subscription.IsActive,
            subscription.CreatedAtUtc,
            subscription.UpdatedAtUtc);
    }

    private static string? NormalizeEmail(string email)
    {
        string normalizedEmail = email.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            return null;
        }

        try
        {
            var address = new MailAddress(normalizedEmail);
            return string.Equals(address.Address, normalizedEmail, StringComparison.OrdinalIgnoreCase)
                ? normalizedEmail
                : null;
        }
        catch (FormatException)
        {
            return null;
        }
    }

    private static string? NormalizeLocale(string? locale)
    {
        string? normalizedLocale = string.IsNullOrWhiteSpace(locale) ? null : locale.Trim().ToLowerInvariant();
        return normalizedLocale is "fa" or "en" ? normalizedLocale : null;
    }

    private static string Csv(string? value)
    {
        string safeValue = value ?? string.Empty;
        return $"\"{safeValue.Replace("\"", "\"\"", StringComparison.Ordinal)}\"";
    }
}
