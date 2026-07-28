using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class ContextBuilder : IContextBuilder
{
    public ContextModel Build(RepositoryMetadata metadata)
    {
        ContextModel context = new();
        context.Features.AddRange(metadata.Features);
        context.Methods.AddRange(metadata.Methods);
        context.Locators.AddRange(metadata.Locators);
        context.Steps.AddRange(metadata.Steps);
        context.Utilities.AddRange(metadata.Utilities);
        context.Relationships.AddRange(metadata.Relationships);
        return context;
    }

    public ContextPackage Build(RepositoryGraph graph, ContextRequest request)
    {
        var requestedFeature = graph.Nodes
            .FirstOrDefault(node => node.Type.Equals("Feature", StringComparison.OrdinalIgnoreCase)
                && node.Name.Equals(request.FeatureName, StringComparison.OrdinalIgnoreCase));

        var package = new ContextPackage();
        if (requestedFeature is null)
        {
            return package;
        }

        var selected = new List<GraphNode> { requestedFeature };
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            requestedFeature.Id
        };

        var frontier = new Queue<GraphNode>();
        frontier.Enqueue(requestedFeature);

        while (frontier.Count > 0)
        {
            var current = frontier.Dequeue();
            foreach (var edge in graph.Edges.Where(edge => edge.SourceId.Equals(current.Id, StringComparison.OrdinalIgnoreCase)))
            {
                var target = graph.Nodes.FirstOrDefault(node => node.Id.Equals(edge.TargetId, StringComparison.OrdinalIgnoreCase));
                if (target is null || !seen.Add(target.Id))
                {
                    continue;
                }

                selected.Add(target);
                frontier.Enqueue(target);
            }
        }

        foreach (var node in selected)
        {
            package.Items.Add(new ContextItem
            {
                Type = node.Type,
                Name = node.Name,
                File = node.File,
                Score = ScoreNode(node, request)
            });
        }

        package.Items = package.Items
            .OrderByDescending(item => item.Score)
            .ToList();

        package.Confidence = package.Items.Count > 0 ? 0.85 : 0.0;
        return package;
    }

    private static double ScoreNode(GraphNode node, ContextRequest request)
    {
        double score = 0.5;

        if (node.Type.Equals("Feature", StringComparison.OrdinalIgnoreCase))
        {
            score += 0.8;
        }
        else if (node.Type.Equals("Page", StringComparison.OrdinalIgnoreCase))
        {
            score += 0.4;
        }
        else if (node.Type.Equals("Method", StringComparison.OrdinalIgnoreCase))
        {
            score += 0.2;
        }

        if (!string.IsNullOrWhiteSpace(request.BusinessArea) && node.Metadata.TryGetValue("BusinessArea", out var businessArea) && businessArea is string business)
        {
            if (business.Equals(request.BusinessArea, StringComparison.OrdinalIgnoreCase))
            {
                score += 0.2;
            }
        }

        if (!string.IsNullOrWhiteSpace(request.ScenarioName) && node.Name.Contains(request.ScenarioName, StringComparison.OrdinalIgnoreCase))
        {
            score += 0.1;
        }

        return Math.Round(score, 2);
    }
}