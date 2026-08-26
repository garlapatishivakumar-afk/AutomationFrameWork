using System;
using System.Collections.Generic;
using System.Linq;
using AIAutomationGenerator.Planning;

namespace AIAutomationGenerator.Optimization;

public interface IValidationImpactAnalyzer
{
    IReadOnlyList<string> GetImpactedTestProjects(IReadOnlyList<FilePlan> plans, string repositoryRoot);
}

public sealed class ValidationImpactAnalyzer : IValidationImpactAnalyzer
{
    public IReadOnlyList<string> GetImpactedTestProjects(IReadOnlyList<FilePlan> plans, string repositoryRoot)
    {
        if (plans == null || plans.Count == 0)
        {
            return Array.Empty<string>();
        }

        bool touchedTestAssets = plans.Any(p =>
            p.FilePath.Contains("Features/", StringComparison.OrdinalIgnoreCase) ||
            p.FilePath.Contains("StepDefinitions/", StringComparison.OrdinalIgnoreCase) ||
            p.FilePath.Contains("PageActions/", StringComparison.OrdinalIgnoreCase) ||
            p.FilePath.Contains("PageElements/", StringComparison.OrdinalIgnoreCase));

        if (!touchedTestAssets)
        {
            return Array.Empty<string>();
        }

        return new[] { repositoryRoot };
    }
}