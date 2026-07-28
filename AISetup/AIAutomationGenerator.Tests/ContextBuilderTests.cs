using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests;

public class ContextBuilderTests
{
    [Fact]
    public void Build_ReturnsFeatureAndRelatedNodesForRequestedFeature()
    {
        var graph = new RepositoryGraph
        {
            Nodes =
            [
                new GraphNode { Id = "Feature:Login", Type = "Feature", Name = "Login" },
                new GraphNode { Id = "Page:LoginPage", Type = "Page", Name = "LoginPage" },
                new GraphNode { Id = "Method:ClickLogin", Type = "Method", Name = "ClickLogin" },
                new GraphNode { Id = "Locator:UsernameField", Type = "Locator", Name = "UsernameField" }
            ],
            Edges =
            [
                new GraphEdge { SourceId = "Feature:Login", TargetId = "Page:LoginPage", RelationshipType = "UsesPage" },
                new GraphEdge { SourceId = "Page:LoginPage", TargetId = "Method:ClickLogin", RelationshipType = "ContainsMethod" },
                new GraphEdge { SourceId = "Page:LoginPage", TargetId = "Locator:UsernameField", RelationshipType = "ContainsLocator" }
            ]
        };

        var builder = new ContextBuilder();
        var package = builder.Build(graph, new ContextRequest { FeatureName = "Login" });

        Assert.NotNull(package);
        Assert.Contains(package.Items, item => item.Type == "Feature" && item.Name == "Login");
        Assert.Contains(package.Items, item => item.Type == "Page" && item.Name == "LoginPage");
        Assert.Contains(package.Items, item => item.Type == "Method" && item.Name == "ClickLogin");
        Assert.True(package.Confidence > 0);
    }
}
