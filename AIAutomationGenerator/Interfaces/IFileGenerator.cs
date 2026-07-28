using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IFileGenerator
{
    Task GenerateAsync(AIResponseModel responseModel, string outputFolder);
}