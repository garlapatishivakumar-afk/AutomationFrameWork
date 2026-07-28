using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIClient
{
    Task<AIResponse> SendAsync(
        AIConfiguration configuration,
        AIRequest request);
}