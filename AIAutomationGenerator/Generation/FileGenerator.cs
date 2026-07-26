using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Generation;

public class FileGenerator : IFileGenerator
{
    public async Task GenerateAsync(GeneratedScript script, string outputFolder)
    {
        Directory.CreateDirectory(outputFolder);

        await File.WriteAllTextAsync(Path.Combine(outputFolder, "Prompt.md"), string.Empty);
        await File.WriteAllTextAsync(Path.Combine(outputFolder, "Context.json"), string.Empty);
        await File.WriteAllTextAsync(Path.Combine(outputFolder, "BusinessFlow.json"), string.Empty);
        await File.WriteAllTextAsync(Path.Combine(outputFolder, "RepositoryMetadata.json"), string.Empty);
        await File.WriteAllTextAsync(Path.Combine(outputFolder, "Recording.json"), string.Empty);
    }
}