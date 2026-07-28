using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IContextFingerprintService
{
    string GenerateFingerprint(
        RepositoryMetadata metadata,
        string repositoryPath,
        string generatorVersion);
}
