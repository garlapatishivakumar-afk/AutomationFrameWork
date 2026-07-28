using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests.Intelligence;

public class ContextRankingServiceTests
{
    [Fact]
    public void RankContext_ShouldOrderItemsByScore()
    {
        var service = new ContextRankingService();

        var package = new ContextPackage
        {
            Items =
            [
                new ContextItem
                {
                    Name = "ClickLogin",
                    Type = "Method",
                    Score = 1
                },

                new ContextItem
                {
                    Name = "Login",
                    Type = "Feature",
                    Score = 1
                },

                new ContextItem
                {
                    Name = "LoginPage",
                    Type = "Page",
                    Score = 1
                }
            ]
        };

        var request = new ContextRequest
        {
            FeatureName = "Login"
        };

        var ranked = service.RankContext(package, request);

        Assert.Equal("Login", ranked.Items.First().Name);
        Assert.True(ranked.Confidence > 0);
    }
}