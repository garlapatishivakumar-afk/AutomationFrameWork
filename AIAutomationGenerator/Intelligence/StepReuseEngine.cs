using System.Linq;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class StepReuseEngine : IStepReuseEngine
{
    private readonly IStepSimilarityEngine similarityEngine;

    public StepReuseEngine(IStepSimilarityEngine similarityEngine)
    {
        this.similarityEngine = similarityEngine;
    }

    public List<StepDefinitionModel> FindReusableSteps(
        ContextModel context,
        List<BusinessFlowModel> flows)
    {
        if (flows.Count == 0)
            return [];

        List<RecordingActionModel> actions =
            flows.SelectMany(x => x.Actions).ToList();

        return similarityEngine.FindBestMatches(
            context.Steps,
            actions);
    }
}