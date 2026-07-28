using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class OpenAIProvider : IAIProvider
{
    private readonly IAIClient aiClient;
    private readonly AIConfiguration configuration;

    public OpenAIProvider(
        IAIClient aiClient,
        IAIConfigurationProvider configurationProvider)
    {
        this.aiClient = aiClient;
        configuration = configurationProvider.GetConfiguration();
    }

    public async Task<AIResponse> GenerateAsync(
        AIRequest request)
    {
        if (!configuration.Enabled)
        {
            return new AIResponse
            {
                Success = false,
                ErrorMessage = "AI Provider is disabled."
            };
        }

        if (string.IsNullOrWhiteSpace(configuration.ApiKey))
        {
            return new AIResponse
            {
                Success = false,
                ErrorMessage = "OpenAI API Key not configured."
            };
        }

        return await aiClient.SendAsync(
            configuration,
            request);
    }
}