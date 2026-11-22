namespace Application.Auth;

/// <summary>Validated Google identity claims. Implementations verify the signature before returning claims.</summary>
public interface IGoogleCredentialVerifier
{
    Task<GoogleIdentity?> VerifyAsync(string credential, string audience, CancellationToken ct);
}

public sealed record GoogleIdentity(string Subject, string Email, string? Name, string? GivenName, string? FamilyName);
