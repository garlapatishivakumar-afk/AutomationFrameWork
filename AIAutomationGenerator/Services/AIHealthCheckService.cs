using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Services;

public class AIHealthCheckService : IAIHealthCheckService
{
    private readonly IAIConfigurationProvider configurationProvider;
    private readonly IAIClient client;

    public AIHealthCheckService(
        IAIConfigurationProvider configurationProvider,
        IAIClient client)
    {
        this.configurationProvider = configurationProvider;
        this.client = client;
    }

    public async Task<bool> CheckAsync()
    {
        AIConfiguration configuration =
            configurationProvider.GetConfiguration();

        AIRequest request = new()
        {
            Prompt = "Reply with OK."
        };

        AIResponse response =
            await client.SendAsync(configuration, request);

        return response.Success;
    }
}
