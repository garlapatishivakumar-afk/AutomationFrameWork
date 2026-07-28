using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IRepositoryScanner
{
    Task ScanAsync(string rootPath, RepositoryMetadata metadata);
}