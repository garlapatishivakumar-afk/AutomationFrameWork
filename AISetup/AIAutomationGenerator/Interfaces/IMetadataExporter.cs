using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IMetadataExporter
{
    Task ExportAsync(RepositoryMetadata metadata, string outputFolder);
}