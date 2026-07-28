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

    [Fact]
    public void CalculateStatistics_ReturnsTokenReductionMetrics()
    {
        var service = new PromptOptimizationService();

        ContextPackage original = new();
        original.Items.Add(new ContextItem { Type = "Method", Name = "A", File = "A.cs", Score = 1.0 });
        original.Items.Add(new ContextItem { Type = "Method", Name = "B", File = "B.cs", Score = 0.9 });
        original.Items.Add(new ContextItem { Type = "Method", Name = "C", File = "C.cs", Score = 0.8 });

        ContextPackage optimized = new();
        optimized.Items.Add(new ContextItem { Type = "Method", Name = "A", File = "A.cs", Score = 1.0 });

        PromptOptimizationStatistics stats = service.CalculateStatistics(original, optimized);

        Assert.True(stats.OriginalTokens >= stats.OptimizedTokens);
        Assert.True(stats.TokensRemoved >= 0);
        Assert.True(stats.OptimizationPercentage >= 0);
    }
}
