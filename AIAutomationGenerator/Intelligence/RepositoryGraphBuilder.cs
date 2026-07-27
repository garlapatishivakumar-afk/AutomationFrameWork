using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class RepositoryGraphBuilder : IRepositoryGraphBuilder
{
    public RepositoryGraph Build(RepositoryKnowledge knowledge)
    {
        var graph = new RepositoryGraph();
        var nodeLookup = new Dictionary<string, GraphNode>(StringComparer.OrdinalIgnoreCase);

        void AddNode(string type, string name, string file, Dictionary<string, object>? metadata = null)
        {
            string id = $"{type}:{name}";
            if (nodeLookup.ContainsKey(id))
            {
                return;
            }

            var node = new GraphNode
            {
                Id = id,
                Type = type,
                Name = name,
                File = file,
                Metadata = metadata ?? new Dictionary<string, object>()
            };

            nodeLookup[id] = node;
            graph.Nodes.Add(node);
        }

        void AddEdge(string sourceName, string targetName, string relationType)
        {
            if (!nodeLookup.TryGetValue(sourceName, out var sourceNode) || !nodeLookup.TryGetValue(targetName, out var targetNode))
            {
                return;
            }

            graph.Edges.Add(new GraphEdge
            {
                SourceId = sourceNode.Id,
                TargetId = targetNode.Id,
                RelationshipType = relationType
            });
        }

        foreach (var feature in knowledge.Features)
        {
            AddNode("Feature", feature.Name, string.Empty, new Dictionary<string, object>
            {
                ["BusinessArea"] = feature.BusinessArea,
                ["Confidence"] = feature.Confidence
            });
        }

        foreach (var page in knowledge.Pages)
        {
            AddNode("Page", page.Name, string.Empty, new Dictionary<string, object>
            {
                ["MethodCount"] = page.Methods.Count,
                ["LocatorCount"] = page.Locators.Count
            });

            foreach (var method in page.Methods)
            {
                AddNode("Method", method, string.Empty);
                AddEdge($"Page:{page.Name}", $"Method:{method}", "ContainsMethod");
            }

            foreach (var locator in page.Locators)
            {
                AddNode("Locator", locator, string.Empty);
                AddEdge($"Page:{page.Name}", $"Locator:{locator}", "ContainsLocator");
            }
        }

        foreach (var utility in knowledge.Utilities)
        {
            AddNode("Utility", utility.Name, string.Empty);
        }

        foreach (var flow in knowledge.BusinessFlows)
        {
            AddNode("BusinessFlow", flow.Name, string.Empty);
        }

        foreach (var relationship in knowledge.Relationships)
        {
            string source = relationship.Source;
            string target = relationship.Target;
            if (!string.IsNullOrWhiteSpace(source) && !string.IsNullOrWhiteSpace(target))
            {
                string sourceKey = ResolveNodeKey(source, knowledge);
                string targetKey = ResolveNodeKey(target, knowledge);
                if (!string.IsNullOrWhiteSpace(sourceKey) && !string.IsNullOrWhiteSpace(targetKey))
                {
                    AddNode(ResolveNodeType(source, knowledge), source, string.Empty);
                    AddNode(ResolveNodeType(target, knowledge), target, string.Empty);
                    AddEdge(sourceKey, targetKey, relationship.RelationshipType);
                }
            }
        }

        foreach (var feature in knowledge.Features)
        {
            foreach (var page in knowledge.Pages)
            {
                if (feature.Name.Equals(page.Name, StringComparison.OrdinalIgnoreCase) || feature.Name.Contains(page.Name, StringComparison.OrdinalIgnoreCase) || page.Name.Contains(feature.Name, StringComparison.OrdinalIgnoreCase))
                {
                    AddEdge($"Feature:{feature.Name}", $"Page:{page.Name}", "UsesPage");
                }
            }
        }

        return graph;
    }

    private static string ResolveNodeKey(string value, RepositoryKnowledge knowledge)
    {
        if (knowledge.Features.Any(x => x.Name.Equals(value, StringComparison.OrdinalIgnoreCase)))
        {
            return $"Feature:{value}";
        }

        if (knowledge.Pages.Any(x => x.Name.Equals(value, StringComparison.OrdinalIgnoreCase)))
        {
            return $"Page:{value}";
        }

        if (knowledge.Utilities.Any(x => x.Name.Equals(value, StringComparison.OrdinalIgnoreCase)))
        {
            return $"Utility:{value}";
        }

        return string.Empty;
    }

    private static string ResolveNodeType(string value, RepositoryKnowledge knowledge)
    {
        if (knowledge.Features.Any(x => x.Name.Equals(value, StringComparison.OrdinalIgnoreCase)))
        {
            return "Feature";
        }

        if (knowledge.Pages.Any(x => x.Name.Equals(value, StringComparison.OrdinalIgnoreCase)))
        {
            return "Page";
        }

        if (knowledge.Utilities.Any(x => x.Name.Equals(value, StringComparison.OrdinalIgnoreCase)))
        {
            return "Utility";
        }

        return "Entity";
    }
}
