using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIMetricsPersistence
{
    void Save(IReadOnlyList<AIMetrics> metrics);

    IReadOnlyList<AIMetrics> Load();
}
