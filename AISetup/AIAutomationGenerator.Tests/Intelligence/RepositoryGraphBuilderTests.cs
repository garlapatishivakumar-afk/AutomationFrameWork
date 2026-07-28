using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests.Intelligence;

public class RepositoryGraphBuilderTests
{
    [Fact]
    public void Build_CreatesExpectedNodesAndEdges()
    {
        var builder = new RepositoryGraphBuilder();
        var knowledge = new RepositoryKnowledge
        {
            Features =
            [
                new FeatureKnowledge { Name = "Login" }
            ],
            Pages =
            [
                new PageKnowledge
                {
                    Name = "LoginPage",
                    Methods = [ "ClickLogin" ],
                    Locators = [ "UserName" ]
                }
            ],
            Utilities =
            [
                new UtilityKnowledge { Name = "ExcelHelper" }
            ],
            Relationships =
            [
                new RelationshipModel { Source = "Login", Target = "LoginPage", RelationshipType = "Uses" }
            ]
        };

        var graph = builder.Build(knowledge);

        Assert.Equal(5, graph.Nodes.Count);
        Assert.Equal(4, graph.Edges.Count);
        Assert.Contains(graph.Nodes, node => node.Type == "Feature" && node.Name == "Login");
        Assert.Contains(graph.Nodes, node => node.Type == "Page" && node.Name == "LoginPage");
        Assert.Contains(graph.Nodes, node => node.Type == "Method" && node.Name == "ClickLogin");
        Assert.Contains(graph.Nodes, node => node.Type == "Locator" && node.Name == "UserName");
        Assert.Contains(graph.Edges, edge => edge.RelationshipType == "ContainsMethod");
        Assert.Contains(graph.Edges, edge => edge.RelationshipType == "ContainsLocator");
        Assert.Contains(graph.Edges, edge => edge.RelationshipType == "Uses");
    }
}
