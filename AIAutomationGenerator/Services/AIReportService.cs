using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Services;

public class AIReportService : IAIReportService
{
    private readonly IAIMetricsService metricsService;

    public AIReportService(
        IAIMetricsService metricsService)
    {
        this.metricsService = metricsService;
    }

    public AIReport Generate()
    {
        IReadOnlyList<AIMetrics> metrics =
            metricsService.GetMetrics();

        if (metrics.Count == 0)
        {
            return new AIReport();
        }

        return new AIReport
        {
            TotalRequests = metrics.Count,

            SuccessfulRequests =
                metrics.Count(x => x.Success),

            FailedRequests =
                metrics.Count(x => !x.Success),

            PromptTokens =
                metrics.Sum(x => x.PromptTokens),

            CompletionTokens =
                metrics.Sum(x => x.CompletionTokens),

            TotalTokens =
                metrics.Sum(x => x.TotalTokens),

            EstimatedCost =
                metrics.Sum(x => x.EstimatedCost),

            AverageResponseTime =
                TimeSpan.FromMilliseconds(
                    metrics.Average(x => x.Duration.TotalMilliseconds)),

            SuccessRate =
                metrics.Count(x => x.Success) * 100.0 / metrics.Count
        };
    }
}
