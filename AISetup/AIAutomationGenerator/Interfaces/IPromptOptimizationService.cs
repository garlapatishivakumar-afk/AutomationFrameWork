using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IPromptOptimizationService
{
    PromptStatistics Analyze(ContextPackage package);
    ContextPackage Optimize(ContextPackage package);
    PromptOptimizationStatistics CalculateStatistics(ContextPackage originalPackage, ContextPackage optimizedPackage);
}