using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class MethodSimilarityEngine : IMethodSimilarityEngine
{
    public List<MethodModel> FindBestMatches(
        List<MethodModel> methods,
        List<RecordingActionModel> actions)
    {
        foreach (var method in methods)
        {
            method.Score = CalculateScore(method, actions);
        }
        return methods
            .OrderByDescending(x => x.Score)
            .Take(10)
            .ToList();
    }
    private static int CalculateScore(
        MethodModel method,
        List<RecordingActionModel> actions)
    {
        int score = 0;
        foreach (var action in actions)
        {
            if (method.Name.Contains(action.ActionType,StringComparison.OrdinalIgnoreCase))
            {
                score += 10;
            }
        }
        return score;
    }
}