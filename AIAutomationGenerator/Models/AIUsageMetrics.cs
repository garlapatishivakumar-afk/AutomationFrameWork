namespace AIAutomationGenerator.Models;

public class AIUsageMetrics
{
    public string Provider { get; set; } = string.Empty;

    public string Model { get; set; } = string.Empty;

    public int PromptTokens { get; set; }

    public int CompletionTokens { get; set; }

    public int TotalTokens { get; set; }

    public decimal EstimatedCost { get; set; }

    public TimeSpan Duration { get; set; }
}
