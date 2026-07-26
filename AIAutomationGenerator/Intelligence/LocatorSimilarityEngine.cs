using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class LocatorSimilarityEngine : ILocatorSimilarityEngine
{
    public List<LocatorModel> FindBestMatches(
        List<LocatorModel> locators,
        List<RecordingActionModel> actions)
    {
        foreach (var locator in locators)
        {
            locator.Score = CalculateScore(locator, actions);
        }

        return locators
            .OrderByDescending(x => x.Score)
            .Take(15)
            .ToList();
    }

    private static int CalculateScore(
        LocatorModel locator,
        List<RecordingActionModel> actions)
    {
        int score = 0;

        foreach (var action in actions)
        {
            if (locator.Name.Contains(
                action.ActionType,
                StringComparison.OrdinalIgnoreCase))
            {
                score += 10;
            }

            if (locator.Name.Contains(
                action.LocatorValue,
                StringComparison.OrdinalIgnoreCase))
            {
                score += 20;
            }
        }

        return score;
    }
}