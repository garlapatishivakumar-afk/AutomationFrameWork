using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using Microsoft.Extensions.DependencyInjection;

namespace AIAutomationGenerator.AI;

public class AIProviderFactory : IAIProviderFactory
{
    private readonly IServiceProvider serviceProvider;
    private readonly AIProviderSettings settings;

    public AIProviderFactory(
        IServiceProvider serviceProvider,
        AIProviderSettings settings)
    {
        this.serviceProvider = serviceProvider;
        this.settings = settings;
    }

    public IAIProvider Create()
    {
        string provider = settings.Provider?.Trim() ?? "Mock";

        return provider.ToLowerInvariant() switch
        {
            "openai" => serviceProvider.GetRequiredService<OpenAIProvider>(),
            "gemini" => serviceProvider.GetRequiredService<GeminiProvider>(),
            "azureopenai" => serviceProvider.GetRequiredService<AzureOpenAIProvider>(),
            "mock" => serviceProvider.GetRequiredService<MockAIProvider>(),
            _ => throw new InvalidOperationException($"Unsupported AI provider: {provider}")
        };
    }
}
