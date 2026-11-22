using System.Net;

namespace API;

/// <summary>
/// Routes only Google's public signing-certificate downloads through an optional
/// HTTPS CONNECT egress, preserving the process's existing proxy behavior for
/// payment, messaging, and all other destinations.
/// </summary>
public sealed class GoogleCertificateEgressProxy : IWebProxy
{
    private readonly IWebProxy _fallback;
    private readonly Uri _endpoint;

    public GoogleCertificateEgressProxy(string proxyUrl, IWebProxy fallback)
    {
        ArgumentNullException.ThrowIfNull(fallback);
        if (!Uri.TryCreate(proxyUrl, UriKind.Absolute, out var endpoint)
            || endpoint.Scheme != Uri.UriSchemeHttp
            || string.IsNullOrWhiteSpace(endpoint.Host)
            || !string.IsNullOrEmpty(endpoint.UserInfo)
            || endpoint.AbsolutePath != "/"
            || !string.IsNullOrEmpty(endpoint.Query)
            || !string.IsNullOrEmpty(endpoint.Fragment))
        {
            throw new ArgumentException("Google:EgressProxy must be a plain HTTP CONNECT proxy URL without credentials or a path.", nameof(proxyUrl));
        }

        _fallback = fallback;
        _endpoint = endpoint;
    }

    private static bool IsGoogleCertificatesHost(Uri destination) =>
        destination.Scheme == Uri.UriSchemeHttps
        && destination.IdnHost.Equals("www.googleapis.com", StringComparison.OrdinalIgnoreCase)
        && destination.IsDefaultPort;

    public Uri GetProxy(Uri destination) =>
        IsGoogleCertificatesHost(destination) ? _endpoint : (_fallback.GetProxy(destination) ?? destination);

    public bool IsBypassed(Uri destination) =>
        !IsGoogleCertificatesHost(destination) && _fallback.IsBypassed(destination);

    public ICredentials? Credentials
    {
        get => _fallback.Credentials;
        set => _fallback.Credentials = value;
    }
}
