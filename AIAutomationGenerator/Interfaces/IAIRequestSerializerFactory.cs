using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIRequestSerializerFactory
{
    IAIRequestSerializer Create(AIConfiguration configuration);
}
