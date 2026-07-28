using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IRelationshipBuilder
{
    void Build(RepositoryMetadata metadata);
}