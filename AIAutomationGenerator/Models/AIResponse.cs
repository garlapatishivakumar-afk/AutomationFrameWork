namespace AIAutomationGenerator.Models;

public class AIResponse
{
    public bool Success { get; set; }
    public string Content { get; set; } = string.Empty;
    public string ErrorMessage { get; set; } = string.Empty;
    public AIUsageMetrics Usage { get; set; } = new();
}