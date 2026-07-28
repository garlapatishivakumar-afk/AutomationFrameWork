using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class AzureOpenAIProvider : IAIProvider
{
    private const string ApiVersion = "2024-02-15-preview";

    private readonly IAIClient aiClient;
    private readonly AIProviderSettings settings;

    public AzureOpenAIProvider(
        IAIClient aiClient,
        AIProviderSettings settings)
    {
        this.aiClient = aiClient;
        this.settings = settings;
    }

    public async Task<AIResponse> GenerateAsync(AIRequest request)
    {
        if (string.IsNullOrWhiteSpace(settings.ApiKey))
        {
            return new AIResponse
            {
                Success = false,
                ErrorMessage = "Azure OpenAI API key is not configured."
            };
        }

        if (string.IsNullOrWhiteSpace(settings.Endpoint) || string.IsNullOrWhiteSpace(settings.DeploymentName))
        {
            return new AIResponse
            {
                Success = false,
                ErrorMessage = "Azure OpenAI endpoint or deployment name is not configured."
            };
        }

        AIConfiguration configuration = new()
        {
            Enabled = true,
            Provider = "AzureOpenAI",
            Model = settings.Model,
            ApiKey = settings.ApiKey,
            BaseUrl = BuildAzureEndpoint()
        };

        return await aiClient.SendAsync(
            configuration,
            request);
    }

    private string BuildAzureEndpoint()
    {
        string endpoint = settings.Endpoint.TrimEnd('/');

        if (endpoint.Contains("/deployments/", StringComparison.OrdinalIgnoreCase))
        {
            return endpoint;
        }

        return $"{endpoint}/openai/deployments/{settings.DeploymentName}/chat/completions?api-version={ApiVersion}";
    }
}
