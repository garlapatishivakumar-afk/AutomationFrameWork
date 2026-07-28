using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIMetricsService
{
    void Record(AIMetrics metrics);
    IReadOnlyList<AIMetrics> GetMetrics();
}