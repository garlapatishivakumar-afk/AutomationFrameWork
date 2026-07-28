using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class GeminiProvider : IAIProvider
{
    private readonly IAIClient aiClient;
    private readonly AIProviderSettings settings;

    public GeminiProvider(
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
                ErrorMessage = "Gemini API key is not configured."
            };
        }

        if (string.IsNullOrWhiteSpace(settings.Model))
        {
            return new AIResponse
            {
                Success = false,
                ErrorMessage = "Gemini model is not configured."
            };
        }

        AIConfiguration configuration = new()
        {
            Enabled = true,
            Provider = "Gemini",
            Model = settings.Model,
            ApiKey = settings.ApiKey,
            BaseUrl = settings.Endpoint
        };

        return await aiClient.SendAsync(
            configuration,
            request);
    }
}
