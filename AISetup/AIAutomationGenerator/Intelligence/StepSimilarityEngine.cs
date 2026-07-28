using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class StepSimilarityEngine : IStepSimilarityEngine
{
    public List<StepDefinitionModel> FindBestMatches(
        List<StepDefinitionModel> steps,
        List<RecordingActionModel> actions)
    {
        foreach (var step in steps)
        {
            step.Score = CalculateScore(step, actions);
        }

        return steps
            .OrderByDescending(x => x.Score)
            .Take(15)
            .ToList();
    }

    private static int CalculateScore(
        StepDefinitionModel step,
        List<RecordingActionModel> actions)
    {
        int score = 0;

        foreach (var action in actions)
        {
            if (step.StepText.Contains(
                action.ActionType,
                StringComparison.OrdinalIgnoreCase))
            {
                score += 10;
            }

            if (step.StepText.Contains(
                action.LocatorValue,
                StringComparison.OrdinalIgnoreCase))
            {
                score += 20;
            }
        }

        return score;
    }
}