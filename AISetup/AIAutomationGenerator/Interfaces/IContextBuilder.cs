using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IContextBuilder
{
    ContextModel Build(RepositoryMetadata metadata);
    ContextPackage Build(RepositoryGraph graph, ContextRequest request);
}