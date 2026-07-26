using Microsoft.Extensions.Configuration;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class AIConfigurationProvider : IAIConfigurationProvider
{
    private readonly AIConfiguration configuration;

    public AIConfigurationProvider()
    {
        IConfigurationRoot config =
            new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        configuration = new AIConfiguration();

        config.GetSection("AI").Bind(configuration);
    }

    public AIConfiguration GetConfiguration()
    {
        return configuration;
    }
}