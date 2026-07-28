using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Services;

public class AIMetricsService : IAIMetricsService
{
    private readonly IAIMetricsPersistence persistence;
    private readonly List<AIMetrics> metrics;

    public AIMetricsService(
        IAIMetricsPersistence persistence)
    {
        this.persistence = persistence;
        metrics = persistence.Load().ToList();
    }

    public void Record(AIMetrics metric)
    {
        lock (metrics)
        {
            metrics.Add(metric);
            persistence.Save(metrics);
        }
    }

    public IReadOnlyList<AIMetrics> GetMetrics()
    {
        lock (metrics)
        {
            return metrics.ToList();
        }
    }
}