using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

/// <summary>
/// V3.0 extended scoring: multi-signal step similarity.
/// Backward-compatible — FindBestMatches signature unchanged.
/// </summary>
public class StepSimilarityEngine : IStepSimilarityEngine
{
    private readonly double locatorValueWeight;
    private readonly double actionTypeWeight;
    private readonly double locatorArgumentWeight;
    private readonly double targetWeight;
    private readonly double urlWeight;

    public StepSimilarityEngine(
        double locatorValueWeight   = 20.0,
        double actionTypeWeight     = 10.0,
        double locatorArgumentWeight = 12.0,
        double targetWeight         = 8.0,
        double urlWeight            = 5.0)
    {
        this.locatorValueWeight    = locatorValueWeight;
        this.actionTypeWeight      = actionTypeWeight;
        this.locatorArgumentWeight = locatorArgumentWeight;
        this.targetWeight          = targetWeight;
        this.urlWeight             = urlWeight;
    }

    public List<StepDefinitionModel> FindBestMatches(
        List<StepDefinitionModel> steps,
        List<RecordingActionModel> actions)
    {
        foreach (var step in steps)
        {
            step.Score = (int)Math.Round(CalculateScore(step, actions));
        }
        return steps
            .OrderByDescending(x => x.Score)
            .Take(15)
            .ToList();
    }

    private double CalculateScore(StepDefinitionModel step, List<RecordingActionModel> actions)
    {
        double score = 0;

        foreach (var action in actions)
        {
            // Signal 1: Locator value appears in step text
            if (!string.IsNullOrWhiteSpace(action.LocatorValue) &&
                Contains(step.StepText, action.LocatorValue))
                score += locatorValueWeight;

            // Signal 2: Locator argument (role/aria name) in step text
            if (!string.IsNullOrWhiteSpace(action.LocatorArgument) &&
                Contains(step.StepText, action.LocatorArgument))
                score += locatorArgumentWeight;

            // Signal 3: ActionType verb in step text (e.g. "click", "fill", "select")
            if (!string.IsNullOrWhiteSpace(action.ActionType) &&
                Contains(step.StepText, action.ActionType))
                score += actionTypeWeight;

            // Signal 4: Target in step text
            if (!string.IsNullOrWhiteSpace(action.Target) &&
                Contains(step.StepText, action.Target))
                score += targetWeight;

            // Signal 5: URL fragment for navigation steps
            if (!string.IsNullOrWhiteSpace(action.Url) &&
                Contains(step.StepText, ExtractHostSegment(action.Url)))
                score += urlWeight;
        }

        return score;
    }

    private static string ExtractHostSegment(string url)
    {
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return uri.Host;
        return url;
    }

    private static bool Contains(string source, string token) =>
        !string.IsNullOrWhiteSpace(source) &&
        !string.IsNullOrWhiteSpace(token) &&
        source.Contains(token, StringComparison.OrdinalIgnoreCase);
}
