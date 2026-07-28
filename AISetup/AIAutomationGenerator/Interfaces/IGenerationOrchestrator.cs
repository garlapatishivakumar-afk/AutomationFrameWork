namespace AIAutomationGenerator.Interfaces;

public interface IGenerationOrchestrator
{
    Task GenerateAsync(
        string repositoryPath,
        string recordingPath,
        string outputFolder);
}