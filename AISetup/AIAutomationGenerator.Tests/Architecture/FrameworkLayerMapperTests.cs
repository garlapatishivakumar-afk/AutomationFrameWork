using AIAutomationGenerator.Architecture;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests.Architecture;

public class FrameworkLayerMapperTests
{
    private readonly FrameworkLayerMapper mapper = new();

    [Theory]
    [InlineData("Locator",       "PageElements")]
    [InlineData("pageelements",  "PageElements")]
    [InlineData("Method",        "PageActions")]
    [InlineData("pageactions",   "PageActions")]
    [InlineData("Step",          "StepDefinitions")]
    [InlineData("stepdefinition","StepDefinitions")]
    [InlineData("Feature",       "Features")]
    [InlineData("Helper",        "Helpers")]
    public void Map_KnownComponentType_ReturnsCorrectLayer(string componentType, string expectedLayer)
    {
        var metadata = BuildMetadataWithDefaultFiles();
        var result   = mapper.Map(componentType, string.Empty, metadata);

        Assert.Equal(expectedLayer, result.Layer);
        Assert.True(result.Confidence >= 0.5);
        Assert.False(string.IsNullOrWhiteSpace(result.FolderPath));
    }

    [Fact]
    public void Map_UnknownType_WithClickIntent_ReturnsPageActions()
    {
        var result = mapper.Map("unknown", "click button", new RepositoryMetadata());
        Assert.Equal("PageActions", result.Layer);
    }

    [Fact]
    public void Map_UnknownType_WithLocatorIntent_ReturnsPageElements()
    {
        var result = mapper.Map("unknown", "locator for input", new RepositoryMetadata());
        Assert.Equal("PageElements", result.Layer);
    }

    [Fact]
    public void Map_EmptyMetadata_StillReturnsDefaultLayer()
    {
        var result = mapper.Map("Method", "navigate to page", new RepositoryMetadata());
        Assert.False(string.IsNullOrWhiteSpace(result.Layer));
        Assert.False(string.IsNullOrWhiteSpace(result.FolderPath));
    }

    [Fact]
    public void Map_HasNamingConvention()
    {
        var result = mapper.Map("Method", string.Empty, new RepositoryMetadata());
        Assert.False(string.IsNullOrWhiteSpace(result.NamingConvention));
    }

    // ──────────────────────────────────────────────────────────────────────────

    private static RepositoryMetadata BuildMetadataWithDefaultFiles()
    {
        var md = new RepositoryMetadata();
        md.Methods.Add(new MethodModel
        {
            Name      = "ClickButton",
            ClassName = "ViewDashboardMethods",
            FilePath  = "PageActions/ViewDashboardMethods.cs"
        });
        md.Locators.Add(new LocatorModel
        {
            Name     = "SearchButton",
            PageName = "ViewDashboard",
            FilePath = "PageElements/ViewDashboardObjects.cs"
        });
        md.Steps.Add(new StepDefinitionModel
        {
            StepText   = "user clicks the search button",
            MethodName = "WhenUserClicksSearchButton",
            FilePath   = "StepDefinitions/ViewDashboardSteps.cs"
        });
        return md;
    }
}
