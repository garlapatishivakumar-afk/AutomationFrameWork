using System.Text.Json;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Exporters;

public class MetadataExporter : IMetadataExporter
{
    public async Task ExportAsync(RepositoryMetadata metadata, string outputFolder)
    {
        Directory.CreateDirectory(outputFolder);
        string filePath = Path.Combine(outputFolder, "RepositoryMetadata.json");
        JsonSerializerOptions options = new()
        {
            WriteIndented = true
        };
        string json = JsonSerializer.Serialize(metadata, options);
        await File.WriteAllTextAsync(filePath, json);
    }
}