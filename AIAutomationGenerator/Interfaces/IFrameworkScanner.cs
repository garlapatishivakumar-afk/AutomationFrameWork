using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IFrameworkScanner
{
    Task<RepositoryMetadata> ScanAsync(string solutionPath);
}