using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

/// <summary>
/// V3.0 extended scoring: multi-signal locator similarity.
/// Backward-compatible — FindBestMatches signature unchanged.
/// </summary>
public class LocatorSimilarityEngine : ILocatorSimilarityEngine
{
    private readonly double locatorValueWeight;
    private readonly double locatorTypeWeight;
    private readonly double pageNameWeight;
    private readonly double selectorWeight;
    private readonly double nameWeight;

    public LocatorSimilarityEngine(
        double locatorValueWeight = 20.0,
        double locatorTypeWeight  = 8.0,
        double pageNameWeight     = 8.0,
        double selectorWeight     = 15.0,
        double nameWeight         = 10.0)
    {
        this.locatorValueWeight = locatorValueWeight;
        this.locatorTypeWeight  = locatorTypeWeight;
        this.pageNameWeight     = pageNameWeight;
        this.selectorWeight     = selectorWeight;
        this.nameWeight         = nameWeight;
    }

    public List<LocatorModel> FindBestMatches(
        List<LocatorModel> locators,
        List<RecordingActionModel> actions)
    {
        foreach (var locator in locators)
        {
            locator.Score = (int)Math.Round(CalculateScore(locator, actions));
        }
        return locators
            .OrderByDescending(x => x.Score)
            .Take(15)
            .ToList();
    }

    private double CalculateScore(LocatorModel locator, List<RecordingActionModel> actions)
    {
        double score = 0;

        foreach (var action in actions)
        {
            // Signal 1: Locator value matches locator selector or name
            if (!string.IsNullOrWhiteSpace(action.LocatorValue))
            {
                if (Contains(locator.Selector, action.LocatorValue))
                    score += selectorWeight;
                if (Contains(locator.Name, action.LocatorValue))
                    score += locatorValueWeight;
            }

            // Signal 2: Locator argument (role name / aria-label) matches locator name
            if (!string.IsNullOrWhiteSpace(action.LocatorArgument) &&
                Contains(locator.Name, action.LocatorArgument))
                score += locatorValueWeight * 0.8;

            // Signal 3: LocatorType compatibility
            if (!string.IsNullOrWhiteSpace(action.LocatorType) &&
                Contains(locator.LocatorType, action.LocatorType))
                score += locatorTypeWeight;

            // Signal 4: Page name match
            if (!string.IsNullOrWhiteSpace(action.PageName) &&
                Contains(locator.PageName, action.PageName))
                score += pageNameWeight;

            // Signal 5: Generic name overlap
            if (!string.IsNullOrWhiteSpace(action.Target) &&
                Contains(locator.Name, action.Target))
                score += nameWeight;
        }

        return score;
    }

    private static bool Contains(string source, string token) =>
        !string.IsNullOrWhiteSpace(source) &&
        !string.IsNullOrWhiteSpace(token) &&
        source.Contains(token, StringComparison.OrdinalIgnoreCase);
}
