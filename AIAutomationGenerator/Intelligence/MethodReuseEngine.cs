using System.Linq;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class MethodReuseEngine : IMethodReuseEngine
{
    private readonly IMethodSimilarityEngine similarityEngine;

    public MethodReuseEngine(
        IMethodSimilarityEngine similarityEngine)
    {
        this.similarityEngine = similarityEngine;
    }

    public List<MethodModel> FindReusableMethods(
    ContextModel context,
    List<BusinessFlowModel> flows)
{
    if (flows.Count == 0)
        return [];

    List<RecordingActionModel> actions =
        flows.SelectMany(x => x.Actions).ToList();

    return similarityEngine.FindBestMatches(
        context.Methods,
        actions);
}
}