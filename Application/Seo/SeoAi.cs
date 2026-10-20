using System.Collections.Concurrent;
using Application.Interfaces;
using Domain.Entities;
using MediatR;

namespace Application.Seo;

/// <summary>Per-admin sliding window gate. Only explicit inference requests consume this budget.</summary>
public sealed class SeoAiRateGate(TimeProvider time)
{
    private readonly ConcurrentDictionary<string, Queue<DateTimeOffset>> _requests = new();
    public bool TryAcquire(string adminId)
    {
        var now = time.GetUtcNow();
        var queue = _requests.GetOrAdd(adminId, _ => new());
        lock (queue)
        {
            while (queue.TryPeek(out var first) && now - first >= TimeSpan.FromMinutes(1)) queue.Dequeue();
            if (queue.Count >= 5) return false;
            queue.Enqueue(now); return true;
        }
    }
}

/// <summary>Optional AI use cases. Ordinary SEO analysis never invokes this gateway.</summary>
public static class SeoAi
{
    public sealed record ModelsQuery : IRequest<ModelsResult>;
    public sealed record ModelsResult(bool Configured, IReadOnlyList<string> Models);
    public sealed class ModelsHandler(ISeoAiGateway gateway) : IRequestHandler<ModelsQuery, ModelsResult>
    {
        public async Task<ModelsResult> Handle(ModelsQuery request, CancellationToken ct)
        {
            if (!gateway.IsConfigured) return new(false, []);
            try { return new(true, await gateway.GetModelsAsync(ct)); }
            catch (Exception error) when (error is HttpRequestException or TaskCanceledException or InvalidOperationException or System.Text.Json.JsonException)
            { return new(true, []); }
        }
    }
    public sealed record SuggestCommand(string AdminId, string Operation, SeoDraft Draft) : IRequest<Result>;
    public sealed record Result(int Status, string? Error, SeoAiSuggestion? Suggestion);
    public sealed class SuggestHandler(ISeoAiGateway gateway, SeoAiRateGate gate, IProductDescriptionService descriptions)
        : IRequestHandler<SuggestCommand, Result>
    {
        public async Task<Result> Handle(SuggestCommand request, CancellationToken ct)
        {
            if (request.Operation is not ("metadata" or "content" or "advice") || request.Draft.Kind is not ("product" or "category")
                || request.Draft.Content?.Length > 24_000 || request.Draft.Name.Length > 250 || request.Draft.Slug.Length > 280
                || SeoMapping.Validate(request.Draft.Seo) is not null)
                return new(400, "متن ارسالی باید حداکثر ۲۴٬۰۰۰ کاراکتر و عملیات انتخاب‌شده معتبر باشد.", null);
            if (!gateway.IsConfigured) return new(503, "سرویس هوش مصنوعی هنوز در سرور تنظیم نشده است.", null);
            if (!gate.TryAcquire(request.AdminId)) return new(429, "حداکثر پنج درخواست در دقیقه مجاز است. کمی صبر کنید.", null);
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeout.CancelAfter(TimeSpan.FromSeconds(60));
            try
            {
                // Send only public editorial fields, never private specification rows, customer/order data or image URLs.
                var draft = new SeoDraft(request.Draft.Kind, null, request.Draft.Name, request.Draft.Slug,
                    descriptions.Sanitize(request.Draft.Content), request.Draft.Seo is null ? null : request.Draft.Seo with { CanonicalUrl = null, SocialImageUrl = null }, []);
                var value = await gateway.SuggestAsync(request.Operation, draft, timeout.Token);
                string? content = descriptions.Sanitize(value.Content);
                if (request.Operation == "content" && (string.IsNullOrWhiteSpace(content) || content.Length > 24_000))
                    throw new InvalidOperationException("No usable editorial content.");
                return new(200, null, value with { Content = content });
            }
            catch (Exception error) when (error is HttpRequestException or OperationCanceledException or InvalidOperationException or System.Text.Json.JsonException)
            { return new(503, "پاسخ معتبر از سرویس دریافت نشد. متن شما ذخیره یا تغییر نکرده است؛ دوباره تلاش کنید.", null); }
        }
    }
}
