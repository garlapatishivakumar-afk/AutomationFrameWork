using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIResponseDeserializer
{
    AIResponse Deserialize(string response);
}
