using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Optimization;

namespace AIAutomationGenerator.FrameworkScanner;

public class FeatureParser : IFeatureParser
{
    private static readonly IFileContentCacheService FileCache = new FileContentCacheService();

    public FeatureModel Parse(string filePath)
    {
        FeatureModel feature = new()
        {
            Name = Path.GetFileNameWithoutExtension(filePath),
            FilePath = filePath
        };

        string? currentScenario = null;
        bool isScenarioOutline = false;
        bool inBackground = false;
        bool inExamples = false;

        UsageTelemetryService.Current?.IncrementParserInvocations();
        foreach (string rawLine in FileCache.ReadAllText(filePath).Split(new[] { "\r\n", "\n" }, StringSplitOptions.None))
        {
            string line = rawLine.Trim();

            if (string.IsNullOrWhiteSpace(line) || line.StartsWith("#"))
                continue;

            if (line.StartsWith("@"))
            {
                feature.Tags.AddRange(line.Split(' ', StringSplitOptions.RemoveEmptyEntries));
                continue;
            }

            if (line.StartsWith("Feature:", StringComparison.OrdinalIgnoreCase))
            {
                feature.Name = line["Feature:".Length..].Trim();
                feature.BusinessArea = feature.Tags.FirstOrDefault(tag => tag.StartsWith("@area:", StringComparison.OrdinalIgnoreCase))?[6..] ?? string.Empty;
                continue;
            }

            if (line.StartsWith("Background:", StringComparison.OrdinalIgnoreCase))
            {
                inBackground = true;
                inExamples = false;
                continue;
            }

            if (line.StartsWith("Scenario Outline:", StringComparison.OrdinalIgnoreCase) || line.StartsWith("Scenario:", StringComparison.OrdinalIgnoreCase))
            {
                inBackground = false;
                inExamples = false;
                isScenarioOutline = line.StartsWith("Scenario Outline:", StringComparison.OrdinalIgnoreCase);
                currentScenario = line[(isScenarioOutline ? "Scenario Outline:" : "Scenario:").Length..].Trim();
                feature.Scenarios.Add(currentScenario);
                if (isScenarioOutline)
                    feature.ScenarioOutlines.Add(currentScenario);
                continue;
            }

            if (line.StartsWith("Examples:", StringComparison.OrdinalIgnoreCase))
            {
                inExamples = true;
                continue;
            }

            if (inBackground)
            {
                feature.Background.Add(line);
                continue;
            }

            if (inExamples && line.StartsWith("|"))
            {
                feature.Examples.Add(line);
                continue;
            }

            if (currentScenario is not null && IsStep(line))
            {
                feature.UsedStepDefinitions.Add(line);
                if (line.Contains("Page", StringComparison.OrdinalIgnoreCase) || line.Contains("Object", StringComparison.OrdinalIgnoreCase))
                    feature.UsedPageObjects.Add(line);
            }
        }

        return feature;
    }

    private static bool IsStep(string line)
    {
        return line.StartsWith("Given ", StringComparison.OrdinalIgnoreCase)
            || line.StartsWith("When ", StringComparison.OrdinalIgnoreCase)
            || line.StartsWith("Then ", StringComparison.OrdinalIgnoreCase)
            || line.StartsWith("And ", StringComparison.OrdinalIgnoreCase)
            || line.StartsWith("But ", StringComparison.OrdinalIgnoreCase);
    }
}