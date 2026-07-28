using System.Linq;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class LocatorReuseEngine : ILocatorReuseEngine
{
    private readonly ILocatorSimilarityEngine similarityEngine;

    public LocatorReuseEngine(ILocatorSimilarityEngine similarityEngine)
    {
        this.similarityEngine = similarityEngine;
    }

    public List<LocatorModel> FindReusableLocators(
        ContextModel context,
        List<BusinessFlowModel> flows)
    {
        if (flows.Count == 0)
            return [];

        List<RecordingActionModel> actions =
            flows.SelectMany(x => x.Actions).ToList();

        return similarityEngine.FindBestMatches(
            context.Locators,
            actions);
    }
}