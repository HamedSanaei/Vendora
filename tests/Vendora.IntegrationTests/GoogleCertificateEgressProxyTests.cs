using API;
using System.Net;
using Xunit;

namespace Vendora.IntegrationTests;

public sealed class GoogleCertificateEgressProxyTests
{
    private static readonly Uri ExpectedProxy = new("http://127.0.0.1:31845/");
    private static readonly Uri FallbackProxy = new("http://127.0.0.1:38900/");

    [Fact]
    public void GoogleSigningKeys_UseDedicatedEgress()
    {
        var proxy = new GoogleCertificateEgressProxy(ExpectedProxy.ToString(), new WebProxy(FallbackProxy));
        var certs = new Uri("https://www.googleapis.com/oauth2/v3/certs");

        Assert.False(proxy.IsBypassed(certs));
        Assert.Equal(ExpectedProxy, proxy.GetProxy(certs));
    }

    [Theory]
    [InlineData("https://api.tabapay.ir/pay")]
    [InlineData("https://accounts.google.com/.well-known/openid-configuration")]
    [InlineData("http://www.googleapis.com/oauth2/v3/certs")]
    [InlineData("https://www.googleapis.com.example.org/oauth2/v3/certs")]
    [InlineData("https://www.googleapis.com:8443/oauth2/v3/certs")]
    public void OtherDestinations_RetainPreviousProxy(string destination)
    {
        var proxy = new GoogleCertificateEgressProxy(ExpectedProxy.ToString(), new WebProxy(FallbackProxy));
        var uri = new Uri(destination);

        Assert.Equal(FallbackProxy, proxy.GetProxy(uri));
    }

    [Theory]
    [InlineData("ftp://localhost:3128")]
    [InlineData("https://localhost:3128")]
    [InlineData("http://user:password@localhost:3128")]
    [InlineData("http://localhost:3128/other-path")]
    [InlineData("not a URL")]
    public void UnsafeOrUnsupportedProxyConfiguration_FailsClosed(string configuration)
    {
        Assert.Throws<ArgumentException>(
            () => new GoogleCertificateEgressProxy(configuration, new WebProxy(FallbackProxy)));
    }
}
