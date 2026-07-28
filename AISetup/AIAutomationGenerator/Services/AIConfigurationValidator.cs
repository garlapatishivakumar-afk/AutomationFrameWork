using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Services;

public class AIConfigurationValidator : IAIConfigurationValidator
{
    private static readonly HashSet<string> SupportedProviders =
    [
        "OpenAI",
        "Gemini",
        "AzureOpenAI",
        "Mock"
    ];

    public void Validate(AIConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        if (!configuration.Enabled)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(configuration.Provider))
        {
            throw new InvalidOperationException(
                "AI Provider is not configured.");
        }

        if (!SupportedProviders.Contains(configuration.Provider, StringComparer.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Unsupported AI provider: {configuration.Provider}.");
        }

        if (configuration.Timeout <= TimeSpan.Zero)
        {
            throw new InvalidOperationException(
                "AI Timeout must be greater than zero.");
        }

        if (configuration.Provider.Equals("Mock", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(configuration.ApiKey))
        {
            throw new InvalidOperationException(
                "AI API Key is missing.");
        }

        if (string.IsNullOrWhiteSpace(configuration.BaseUrl))
        {
            throw new InvalidOperationException(
                "AI Endpoint is missing.");
        }

        if (string.IsNullOrWhiteSpace(configuration.Model))
        {
            throw new InvalidOperationException(
                "AI Model is missing.");
        }
    }
}
