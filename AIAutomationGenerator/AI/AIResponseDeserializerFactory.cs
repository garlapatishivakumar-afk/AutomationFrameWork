using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class AIResponseDeserializerFactory : IAIResponseDeserializerFactory
{
    private readonly OpenAIResponseDeserializer openAIResponseDeserializer;
    private readonly GeminiResponseDeserializer geminiResponseDeserializer;
    private readonly AzureOpenAIResponseDeserializer azureOpenAIResponseDeserializer;

    public AIResponseDeserializerFactory(
        OpenAIResponseDeserializer openAIResponseDeserializer,
        GeminiResponseDeserializer geminiResponseDeserializer,
        AzureOpenAIResponseDeserializer azureOpenAIResponseDeserializer)
    {
        this.openAIResponseDeserializer = openAIResponseDeserializer;
        this.geminiResponseDeserializer = geminiResponseDeserializer;
        this.azureOpenAIResponseDeserializer = azureOpenAIResponseDeserializer;
    }

    public IAIResponseDeserializer Create(AIConfiguration configuration)
    {
        string provider = configuration.Provider?.Trim() ?? "Mock";

        return provider.ToLowerInvariant() switch
        {
            "openai" => openAIResponseDeserializer,
            "gemini" => geminiResponseDeserializer,
            "azureopenai" => azureOpenAIResponseDeserializer,
            "mock" => openAIResponseDeserializer,
            _ => throw new InvalidOperationException(
                $"Unsupported deserializer for provider '{provider}'.")
        };
    }
}
