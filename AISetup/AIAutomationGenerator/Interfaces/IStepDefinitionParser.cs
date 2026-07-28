using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IStepDefinitionParser
{
    IEnumerable<StepDefinitionModel> Parse(string filePath);
}