using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using System.Text.RegularExpressions;

namespace AIAutomationGenerator.Naming;

public class ArtifactNamingService : IArtifactNamingService
{
    public ArtifactNamingResult Generate(BusinessFlowDetectionResult flow)
    {
        string featureName = BuildFeatureName(flow);

        ArtifactNamingResult result = new();
        result.FeatureName = featureName;
        result.FeatureFile = $"{featureName}.feature";
        result.ObjectsFile = $"{featureName}Objects.cs";
        result.MethodsFile = $"{featureName}Methods.cs";
        result.StepsFile = $"{featureName}Steps.cs";
        result.PageClass = $"{featureName}Page";
        result.ObjectsClass = $"{featureName}Objects";
        result.MethodsClass = $"{featureName}Methods";
        result.StepsClass = $"{featureName}Steps";

        return result;
    }

    private static string BuildFeatureName(BusinessFlowDetectionResult flow)
    {
        string source = string.IsNullOrWhiteSpace(flow.FlowName)
            ? "Generated Flow"
            : flow.FlowName;

        string normalized = Regex.Replace(source, "[^A-Za-z0-9 ]", " ");
        string[] tokens = normalized
            .Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(ToPascal)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToArray();

        if (tokens.Length == 0)
        {
            return "GeneratedFlow";
        }

        return string.Concat(tokens);
    }

    private static string ToPascal(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return string.Empty;
        }

        string lower = token.Trim().ToLowerInvariant();
        return char.ToUpperInvariant(lower[0]) + lower[1..];
    }
}
