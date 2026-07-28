using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class LearningEngine : ILearningEngine
{
    public List<string> Learn(RepositoryMetadata metadata)
    {
        var recommendations = new List<string>();

        foreach (var method in metadata.Methods.OrderByDescending(x => x.Score).Take(5))
        {
            recommendations.Add($"Reuse method: {method.Name}");
        }

        foreach (var locator in metadata.Locators.OrderByDescending(x => x.Score).Take(5))
        {
            recommendations.Add($"Reuse locator: {locator.Name}");
        }

        foreach (var feature in metadata.Features.OrderByDescending(x => x.Name).Take(3))
        {
            recommendations.Add($"Prioritize feature: {feature.Name}");
        }

        return recommendations;
    }

    public Dictionary<string, int> BuildUsageStatistics(RepositoryMetadata metadata)
        {
            var statistics = new Dictionary<string, int>();

            foreach (var method in metadata.Methods)
            {
                statistics[method.Name] = method.Score;
            }

            foreach (var locator in metadata.Locators)
            {
                statistics[locator.Name] = locator.Score;
            }

            return statistics;
        }
}
