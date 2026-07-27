using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIResponseParser
{
    AIResponseModel Parse(string response);
}
