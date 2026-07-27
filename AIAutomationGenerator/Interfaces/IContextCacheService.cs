using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IContextCacheService
{
    Task SaveAsync(string repositoryPath, ContextPackage context);

    Task<ContextPackage?> LoadAsync(string repositoryPath);

    bool Exists(string repositoryPath);
}