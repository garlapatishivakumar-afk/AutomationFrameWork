using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IProviderFallbackService
{
    Task<AIResponse> GenerateAsync(AIRequest request);
}