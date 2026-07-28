using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IRepositoryIndexService
{
    Task<RepositoryMetadata> GetOrBuildAsync(string repositoryPath, Func<Task<RepositoryMetadata>> buildMetadata);
}
