using System.Security.Claims;
using System.Threading.RateLimiting;

namespace API;

/// <summary>Registers the shared per-account posting budget for product discussions.</summary>
public static class DiscussionRateLimiting
{
    /// <summary>Allows five review/question/answer writes per account each minute, without queued writes.</summary>
    public static IServiceCollection AddDiscussionRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("discussion-write", context => RateLimitPartition.GetFixedWindowLimiter(
                context.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous", _ => new FixedWindowRateLimiterOptions
                { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
        });
        return services;
    }
}
