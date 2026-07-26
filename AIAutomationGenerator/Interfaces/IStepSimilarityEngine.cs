using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IStepSimilarityEngine
{
    List<StepDefinitionModel> FindBestMatches(
        List<StepDefinitionModel> steps,
        List<RecordingActionModel> actions);
}