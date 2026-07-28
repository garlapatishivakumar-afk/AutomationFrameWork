using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests;

public class LearningStatisticsTests
{
    [Fact]
    public void BuildUsageStatistics_ReturnsExpectedCounts()
    {
        var engine = new LearningEngine();

        var metadata = new RepositoryMetadata
        {
            Methods =
            [
                new MethodModel
                {
                    Name = "ClickLogin",
                    Score = 10
                }
            ],
            Locators =
            [
                new LocatorModel
                {
                    Name = "Username",
                    Score = 8
                }
            ]
        };

        var stats = engine.BuildUsageStatistics(metadata);

        Assert.Equal(10, stats["ClickLogin"]);
        Assert.Equal(8, stats["Username"]);
    }
}