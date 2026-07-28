using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Services;

public static class AIReportPrinter
{
    public static void Print(AIReport report)
    {
        Console.WriteLine("===== AI REPORT =====");
        Console.WriteLine($"Requests          : {report.TotalRequests}");
        Console.WriteLine($"Successful        : {report.SuccessfulRequests}");
        Console.WriteLine($"Failed            : {report.FailedRequests}");
        Console.WriteLine($"Prompt Tokens     : {report.PromptTokens}");
        Console.WriteLine($"Completion Tokens : {report.CompletionTokens}");
        Console.WriteLine($"Total Tokens      : {report.TotalTokens}");
        Console.WriteLine($"Estimated Cost    : {report.EstimatedCost:C}");
        Console.WriteLine($"Average Time      : {report.AverageResponseTime.TotalSeconds:F2}s");
        Console.WriteLine($"Success Rate      : {report.SuccessRate:F2}%");
    }
}
