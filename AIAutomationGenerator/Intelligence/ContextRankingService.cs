using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class ContextRankingService : IContextRankingService
{
    public ContextPackage RankContext(ContextPackage package, ContextRequest request)
    {
        if (package == null)
        {
            package = new ContextPackage();
        }

        foreach (var item in package.Items)
        {
            double score = item.Score;

            if (!string.IsNullOrWhiteSpace(request?.FeatureName) &&
                item.Name.Contains(request.FeatureName, StringComparison.OrdinalIgnoreCase))
            {
                score += 1.0;
            }

            if (!string.IsNullOrWhiteSpace(request?.ScenarioName) &&
                item.Name.Contains(request.ScenarioName, StringComparison.OrdinalIgnoreCase))
            {
                score += 0.5;
            }

            switch (item.Type)
            {
                case "Feature":
                    score += 0.50;
                    break;

                case "Page":
                    score += 0.40;
                    break;

                case "Method":
                    score += 0.30;
                    break;

                case "Locator":
                    score += 0.20;
                    break;
            }

            item.Score = Math.Round(score, 2);
        }

        package.Items = package.Items
            .OrderByDescending(x => x.Score)
            .ToList();

        package.Confidence =
            package.Items.Count == 0
            ? 0
            : Math.Round(package.Items.Average(x => x.Score), 2);

        return package;
    }
}