using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class PromptOptimizationService : IPromptOptimizationService
{
    public PromptStatistics Analyze(ContextPackage package)
    {
        if (package == null)
        {
            return new PromptStatistics();
        }

        var statistics = new PromptStatistics
        {
            TotalItems = package.Items.Count,
            FeatureCount = package.Items.Count(item => item.Type.Equals("Feature", StringComparison.OrdinalIgnoreCase)),
            PageCount = package.Items.Count(item => item.Type.Equals("Page", StringComparison.OrdinalIgnoreCase)),
            MethodCount = package.Items.Count(item => item.Type.Equals("Method", StringComparison.OrdinalIgnoreCase)),
            LocatorCount = package.Items.Count(item => item.Type.Equals("Locator", StringComparison.OrdinalIgnoreCase)),
            AverageScore = package.Items.Count == 0 ? 0 : Math.Round(package.Items.Average(item => item.Score), 2),
            Confidence = Math.Round(package.Confidence, 2)
        };

        var originalCount = package.Items.Count;
        var optimizedCount = package.Items.Count; 
        if (originalCount > 0)
        {
            statistics.EstimatedTokens = Math.Max(200, optimizedCount * 35);
            statistics.OptimizationPercentage = originalCount == 0 ? 0 : Math.Round((1 - ((double)optimizedCount / originalCount)) * 100, 2);
        }

        return statistics;
    }

    public ContextPackage Optimize(ContextPackage package)
    {
        if (package == null)
        {
            return new ContextPackage();
        }

        var deduped = package.Items
            .Where(item => !string.IsNullOrWhiteSpace(item.Name))
            .GroupBy(item => item.Name.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(group => group.OrderByDescending(item => item.Score).First())
            .OrderByDescending(item => item.Score)
            .ThenBy(item => item.Type, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var optimizedItems = new List<ContextItem>();
        var featureCount = 0;
        var pageCount = 0;
        var methodCount = 0;
        var locatorCount = 0;

        foreach (var item in deduped)
        {
            if (item.Type.Equals("Feature", StringComparison.OrdinalIgnoreCase) && featureCount < 3)
            {
                optimizedItems.Add(item);
                featureCount++;
            }
            else if (item.Type.Equals("Page", StringComparison.OrdinalIgnoreCase) && pageCount < 5)
            {
                optimizedItems.Add(item);
                pageCount++;
            }
            else if (item.Type.Equals("Method", StringComparison.OrdinalIgnoreCase) && methodCount < 10)
            {
                optimizedItems.Add(item);
                methodCount++;
            }
            else if (item.Type.Equals("Locator", StringComparison.OrdinalIgnoreCase) && locatorCount < 10)
            {
                optimizedItems.Add(item);
                locatorCount++;
            }
            else if (optimizedItems.Count < 15)
            {
                optimizedItems.Add(item);
            }
        }

        package.Items = optimizedItems;
        package.Confidence = package.Items.Count == 0 ? 0 : Math.Round(package.Items.Average(item => item.Score), 2);

        return package;
    }
}
