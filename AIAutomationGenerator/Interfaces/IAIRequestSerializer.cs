using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIRequestSerializer
{
    string Serialize(
        AIConfiguration configuration,
        AIRequest request);
}