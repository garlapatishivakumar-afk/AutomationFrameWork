using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class AIRequestSerializerFactory : IAIRequestSerializerFactory
{
    private readonly OpenAIRequestSerializer openAIRequestSerializer;
    private readonly GeminiRequestSerializer geminiRequestSerializer;
    private readonly AzureOpenAIRequestSerializer azureOpenAIRequestSerializer;

    public AIRequestSerializerFactory(
        OpenAIRequestSerializer openAIRequestSerializer,
        GeminiRequestSerializer geminiRequestSerializer,
        AzureOpenAIRequestSerializer azureOpenAIRequestSerializer)
    {
        this.openAIRequestSerializer = openAIRequestSerializer;
        this.geminiRequestSerializer = geminiRequestSerializer;
        this.azureOpenAIRequestSerializer = azureOpenAIRequestSerializer;
    }

    public IAIRequestSerializer Create(AIConfiguration configuration)
    {
        string provider = configuration.Provider?.Trim() ?? "Mock";

        return provider.ToLowerInvariant() switch
        {
            "openai" => openAIRequestSerializer,
            "gemini" => geminiRequestSerializer,
            "azureopenai" => azureOpenAIRequestSerializer,
            "mock" => openAIRequestSerializer,
            _ => throw new InvalidOperationException(
                $"Unsupported serializer for provider '{provider}'.")
        };
    }
}
