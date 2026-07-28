using Microsoft.Extensions.Configuration;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class AIConfigurationProvider : IAIConfigurationProvider
{
    private readonly AIConfiguration configuration;

    public AIConfigurationProvider(IAIConfigurationValidator configurationValidator)
    {
        IConfigurationRoot config =
            new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: true)
            .Build();

        configuration = new AIConfiguration();

        config.GetSection("AI").Bind(configuration);

        AIProviderSettings providerSettings = new();
        config.GetSection("AIProvider").Bind(providerSettings);

        if (!string.IsNullOrWhiteSpace(providerSettings.Provider))
        {
            configuration.Provider = providerSettings.Provider;
        }

        if (!string.IsNullOrWhiteSpace(providerSettings.ApiKey))
        {
            configuration.ApiKey = providerSettings.ApiKey;
        }

        if (!string.IsNullOrWhiteSpace(providerSettings.Model))
        {
            configuration.Model = providerSettings.Model;
        }

        if (!string.IsNullOrWhiteSpace(providerSettings.Endpoint))
        {
            configuration.BaseUrl = providerSettings.Endpoint;
        }

        if (string.IsNullOrWhiteSpace(configuration.BaseUrl))
        {
            configuration.BaseUrl = "https://api.openai.com/v1/chat/completions";
        }

        configuration.Enabled = true;

        configurationValidator.Validate(configuration);
    }

    public AIConfiguration GetConfiguration()
    {
        return configuration;
    }
}