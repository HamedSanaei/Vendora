using Application.Auth;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Vendora.IntegrationTests;

public sealed class GoogleAccountTests
{
    [Theory]
    [InlineData("")]
    [InlineData("not-a-google-id-token")]
    public async Task GoogleLogin_WithoutConfiguredClientId_FailsClosed(string token)
    {
        var settings = new ConfigurationBuilder().AddInMemoryCollection().Build();
        // No store access is possible until the Google ID token has passed verification.
        var handler = new GoogleAccount.LoginHandler(null!, null!, settings);
        var result = await handler.Handle(new GoogleAccount.LoginCommand(token), CancellationToken.None);
        Assert.False(result.Succeeded);
        Assert.Null(result.Account);
    }

    [Fact]
    public async Task GoogleLink_WithoutConfiguredClientId_FailsClosed()
    {
        var settings = new ConfigurationBuilder().AddInMemoryCollection().Build();
        var handler = new GoogleAccount.LinkHandler(null!, settings);
        var result = await handler.Handle(new GoogleAccount.LinkCommand(Guid.NewGuid(), "invalid"), CancellationToken.None);
        Assert.False(result.Succeeded);
        Assert.Null(result.Account);
    }
}
