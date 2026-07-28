using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IRepositoryGraphBuilder
{
    RepositoryGraph Build(RepositoryKnowledge knowledge);
}
