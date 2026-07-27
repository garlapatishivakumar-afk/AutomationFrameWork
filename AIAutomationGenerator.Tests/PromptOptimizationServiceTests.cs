using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests;

public class PromptOptimizationServiceTests
{
    [Fact]
    public void Analyze_ReturnsExpectedStatistics()
    {
        var service = new PromptOptimizationService();
        var package = new ContextPackage
        {
            Confidence = 0.9
        };

        package.Items.Add(new ContextItem { Type = "Feature", Name = "Login", Score = 1.0 });
        package.Items.Add(new ContextItem { Type = "Page", Name = "LoginPage", Score = 0.8 });
        package.Items.Add(new ContextItem { Type = "Method", Name = "ClickLogin", Score = 0.6 });

        var statistics = service.Analyze(package);

        Assert.Equal(3, statistics.TotalItems);
        Assert.Equal(1, statistics.FeatureCount);
        Assert.Equal(1, statistics.PageCount);
        Assert.Equal(1, statistics.MethodCount);
        Assert.Equal(0, statistics.LocatorCount);
        Assert.Equal(0.8, statistics.AverageScore);
        Assert.Equal(0.9, statistics.Confidence);
    }
}
