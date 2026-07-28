using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Services;

public class AIHealthCheckService : IAIHealthCheckService
{
    private readonly IAIProviderFactory providerFactory;

    public AIHealthCheckService(
        IAIProviderFactory providerFactory)
    {
        this.providerFactory = providerFactory;
    }

    public async Task<bool> CheckAsync()
    {
        IAIProvider provider =
            providerFactory.Create();

        AIResponse response =
            await provider.GenerateAsync(new AIRequest
            {
                Prompt = "Reply with OK."
            });

        return response.Success;
    }
}
