using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface ILearningEngine
{
    List<string> Learn(RepositoryMetadata metadata);

    Dictionary<string, int> BuildUsageStatistics(
        RepositoryMetadata metadata);
}