using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests;

public class LearningEngineTests
{
    [Fact]
    public void Learn_StoresReusableItemsAndRecommendations()
    {
        var engine = new LearningEngine();
        var metadata = new RepositoryMetadata
        {
            Methods =
            [
                new MethodModel { Name = "ClickLogin", Score = 9 }
            ],
            Locators =
            [
                new LocatorModel { Name = "UsernameField", Score = 8 }
            ],
            Features =
            [
                new FeatureModel { Name = "Login" }
            ]
        };

        var recommendations = engine.Learn(metadata);

        Assert.NotEmpty(recommendations);
        Assert.Contains(recommendations, item => item.Contains("ClickLogin", StringComparison.OrdinalIgnoreCase));
    }
}
