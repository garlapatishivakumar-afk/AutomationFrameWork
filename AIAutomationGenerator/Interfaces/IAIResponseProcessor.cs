using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIResponseProcessor
{
    GeneratedScript Process(AIResponse response);
}