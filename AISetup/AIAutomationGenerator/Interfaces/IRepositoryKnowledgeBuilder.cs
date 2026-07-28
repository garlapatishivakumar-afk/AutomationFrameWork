using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IRepositoryKnowledgeBuilder
{
    RepositoryKnowledge Build(RepositoryMetadata metadata);
}