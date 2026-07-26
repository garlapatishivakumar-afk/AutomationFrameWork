using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface ILocatorSimilarityEngine
{
    List<LocatorModel> FindBestMatches(
        List<LocatorModel> locators,
        List<RecordingActionModel> actions);
}