namespace AIAutomationGenerator.Models;

public class PromptStatistics
{
    public int TotalItems { get; set; }
    public int FeatureCount { get; set; }
    public int PageCount { get; set; }
    public int MethodCount { get; set; }
    public int LocatorCount { get; set; }
    public double AverageScore { get; set; }
    public double Confidence { get; set; }
    public int EstimatedTokens { get; set; }
    public double OptimizationPercentage { get; set; }
}
