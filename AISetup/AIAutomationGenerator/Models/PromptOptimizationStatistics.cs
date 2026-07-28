namespace AIAutomationGenerator.Models;

public class PromptOptimizationStatistics
{
    public int OriginalTokens { get; set; }
    public int OptimizedTokens { get; set; }
    public int TokensRemoved { get; set; }
    public double OptimizationPercentage { get; set; }
}
