using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIResponseDeserializerFactory
{
    IAIResponseDeserializer Create(AIConfiguration configuration);
}
