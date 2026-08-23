using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

/// <summary>
/// V3.0 extended scoring: multi-signal similarity for method reuse decisions.
/// Backward-compatible — existing FindBestMatches signature unchanged.
/// </summary>
public class MethodSimilarityEngine : IMethodSimilarityEngine
{
    // Configurable signal weights (all defaulted; caller may substitute via constructor)
    private readonly double actionTypeWeight;
    private readonly double pageNameWeight;
    private readonly double locatorValueWeight;
    private readonly double locatorArgumentWeight;
    private readonly double businessCategoryWeight;
    private readonly double inputValueWeight;

    public MethodSimilarityEngine(
        double actionTypeWeight = 10.0,
        double pageNameWeight = 8.0,
        double locatorValueWeight = 6.0,
        double locatorArgumentWeight = 5.0,
        double businessCategoryWeight = 7.0,
        double inputValueWeight = 3.0)
    {
        this.actionTypeWeight     = actionTypeWeight;
        this.pageNameWeight       = pageNameWeight;
        this.locatorValueWeight   = locatorValueWeight;
        this.locatorArgumentWeight = locatorArgumentWeight;
        this.businessCategoryWeight = businessCategoryWeight;
        this.inputValueWeight     = inputValueWeight;
    }

    public List<MethodModel> FindBestMatches(
        List<MethodModel> methods,
        List<RecordingActionModel> actions)
    {
        foreach (var method in methods)
        {
            method.Score = (int)Math.Round(CalculateScore(method, actions));
        }
        return methods
            .OrderByDescending(x => x.Score)
            .Take(10)
            .ToList();
    }

    private double CalculateScore(MethodModel method, List<RecordingActionModel> actions)
    {
        double score = 0;

        foreach (var action in actions)
        {
            // Signal 1: ActionType match (e.g. "Click", "Fill", "Navigate")
            if (Contains(method.Name, action.ActionType))
                score += actionTypeWeight;

            // Signal 2: Page name match
            if (!string.IsNullOrWhiteSpace(action.PageName) &&
                Contains(method.ClassName, action.PageName))
                score += pageNameWeight;

            // Signal 3: Locator value (semantic control name) in method name
            if (!string.IsNullOrWhiteSpace(action.LocatorValue) &&
                Contains(method.Name, action.LocatorValue))
                score += locatorValueWeight;

            // Signal 4: Locator argument (role name / aria label) in method name
            if (!string.IsNullOrWhiteSpace(action.LocatorArgument) &&
                Contains(method.Name, action.LocatorArgument))
                score += locatorArgumentWeight;

            // Signal 5: Business category match
            if (!string.IsNullOrWhiteSpace(method.BusinessCategory) &&
                !string.IsNullOrWhiteSpace(action.ActionType) &&
                Contains(method.BusinessCategory, action.ActionType))
                score += businessCategoryWeight;

            // Signal 6: Input value appears in method name (e.g. label-derived names)
            if (!string.IsNullOrWhiteSpace(action.InputValue) &&
                action.InputValue.Length >= 3 &&
                Contains(method.Name, action.InputValue))
                score += inputValueWeight;
        }

        return score;
    }

    private static bool Contains(string source, string token) =>
        !string.IsNullOrWhiteSpace(source) &&
        !string.IsNullOrWhiteSpace(token) &&
        source.Contains(token, StringComparison.OrdinalIgnoreCase);
}
