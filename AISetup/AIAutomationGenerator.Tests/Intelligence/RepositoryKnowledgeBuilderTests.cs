using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests.Intelligence;

public class RepositoryKnowledgeBuilderTests
{
    [Fact]
    public void Build_MapsFeaturesPagesMethodsAndLocators()
    {
        var builder = new RepositoryKnowledgeBuilder();
        var metadata = new RepositoryMetadata
        {
            Features =
            [
                new FeatureModel { Name = "Login" }
            ],
            Methods =
            [
                new MethodModel { Name = "ClickLogin", ClassName = "LoginPage" }
            ],
            Locators =
            [
                new LocatorModel { Name = "UserName", PageName = "LoginPage" }
            ],
            Utilities =
            [
                new UtilityModel { Name = "ExcelHelper" }
            ],
            Relationships =
            [
                new RelationshipModel { Source = "Login", Target = "LoginPage", RelationshipType = "Uses" }
            ],
        };

        var knowledge = builder.Build(metadata);

        Assert.Single(knowledge.Features);
        Assert.Single(knowledge.Pages);
        Assert.Single(knowledge.Utilities);
        Assert.Equal("Login", knowledge.Features[0].Name);
        Assert.Equal("LoginPage", knowledge.Pages[0].Name);
        Assert.Contains("ClickLogin", knowledge.Pages[0].Methods);
        Assert.Contains("UserName", knowledge.Pages[0].Locators);
        Assert.Single(knowledge.Relationships);
    }
}
