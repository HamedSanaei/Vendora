using Application.Seo;

namespace Application.Interfaces;

/// <summary>Server-only optional inference port. It has no tools and cannot change business data.</summary>
public interface ISeoAiGateway
{
    bool IsConfigured { get; }
    Task<IReadOnlyList<string>> GetModelsAsync(CancellationToken ct);
    Task<SeoAiSuggestion> SuggestAsync(string operation, SeoDraft draft, CancellationToken ct);
}

/// <summary>Strictly bounded editable suggestions; there are no price, stock, slug or publication fields.</summary>
public sealed record SeoAiSuggestion(string? Title, string? Description, string? Content, IReadOnlyList<string> Advice);
