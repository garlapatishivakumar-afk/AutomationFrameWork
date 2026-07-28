using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using Microsoft.Extensions.DependencyInjection;

namespace AIAutomationGenerator.Services;

public class ProviderFallbackService : IProviderFallbackService
{
    private readonly IServiceProvider serviceProvider;
    private readonly AIProviderSettings settings;

    public ProviderFallbackService(
        IServiceProvider serviceProvider,
        AIProviderSettings settings)
    {
        this.serviceProvider = serviceProvider;
        this.settings = settings;
    }

    public async Task<AIResponse> GenerateAsync(AIRequest request)
    {
        List<string> providers =
        [
            settings.Provider,
            "OpenAI",
            "Gemini",
            "AzureOpenAI",
            "Mock"
        ];

        AIResponse? lastResponse = null;

        foreach (string provider in providers.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            settings.Provider = provider;

            IAIProvider providerInstance =
                serviceProvider
                    .GetRequiredService<IAIProviderFactory>()
                    .Create();

            AIResponse response =
                await providerInstance.GenerateAsync(request);

            if (response.Success)
            {
                return response;
            }

            lastResponse = response;
        }

        return lastResponse ?? new AIResponse
        {
            Success = false,
            ErrorMessage = "No AI provider succeeded."
        };
    }
}