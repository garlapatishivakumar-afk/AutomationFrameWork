using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Generation;

public class FileGenerator : IFileGenerator
{
    public async Task GenerateAsync(AIResponseModel responseModel, string outputFolder)
    {
        Directory.CreateDirectory(outputFolder);

        responseModel ??= new AIResponseModel();

        await File.WriteAllTextAsync(Path.Combine(outputFolder, "Generated.feature"), responseModel.FeatureFile ?? string.Empty);
        await File.WriteAllTextAsync(Path.Combine(outputFolder, "PageObjects.cs"), responseModel.PageObjects ?? string.Empty);
        await File.WriteAllTextAsync(Path.Combine(outputFolder, "Methods.cs"), responseModel.Methods ?? string.Empty);
        await File.WriteAllTextAsync(Path.Combine(outputFolder, "StepDefinitions.cs"), responseModel.StepDefinitions ?? string.Empty);
        await File.WriteAllTextAsync(Path.Combine(outputFolder, "Utilities.cs"), responseModel.Utilities ?? string.Empty);
        await File.WriteAllTextAsync(Path.Combine(outputFolder, "ValidationMessages.cs"), responseModel.ValidationMessages ?? string.Empty);
    }
}