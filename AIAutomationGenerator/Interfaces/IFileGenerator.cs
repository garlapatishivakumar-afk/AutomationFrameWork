using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IFileGenerator
{
    Task GenerateAsync(GeneratedScript script,string outputFolder);
}