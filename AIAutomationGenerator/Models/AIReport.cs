namespace AIAutomationGenerator.Models;

public class AIReport
{
    public int TotalRequests { get; set; }

    public int SuccessfulRequests { get; set; }

    public int FailedRequests { get; set; }

    public int PromptTokens { get; set; }

    public int CompletionTokens { get; set; }

    public int TotalTokens { get; set; }

    public decimal EstimatedCost { get; set; }

    public TimeSpan AverageResponseTime { get; set; }

    public double SuccessRate { get; set; }
}
