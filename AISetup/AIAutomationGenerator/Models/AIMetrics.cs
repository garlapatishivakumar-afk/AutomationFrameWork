namespace AIAutomationGenerator.Models;

public class AIMetrics
{
    public DateTime Timestamp { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public bool Success { get; set; }
    public TimeSpan Duration { get; set; }
    public int PromptTokens { get; set; }
    public int CompletionTokens { get; set; }
    public int TotalTokens { get; set; }
    public decimal EstimatedCost { get; set; }
    public string ErrorMessage { get; set; } = string.Empty;
}