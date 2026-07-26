using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIProvider
{
    Task<AIResponse> GenerateAsync(AIRequest request);
}