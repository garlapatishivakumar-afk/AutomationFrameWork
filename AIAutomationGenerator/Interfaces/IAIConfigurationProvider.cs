using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIConfigurationProvider
{
    AIConfiguration GetConfiguration();
}