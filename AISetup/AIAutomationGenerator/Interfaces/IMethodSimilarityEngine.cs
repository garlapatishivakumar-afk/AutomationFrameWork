using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IMethodSimilarityEngine
{
    List<MethodModel> FindBestMatches(
        List<MethodModel> methods,
        List<RecordingActionModel> actions);
}