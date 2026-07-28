using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIConfigurationValidator
{
    void Validate(AIConfiguration configuration);
}
