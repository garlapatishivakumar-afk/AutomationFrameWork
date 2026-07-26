using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class ContextBuilder : IContextBuilder
{
    public ContextModel Build(RepositoryMetadata metadata)
    {
        ContextModel context = new();
        context.Features.AddRange(metadata.Features);
        context.Methods.AddRange(metadata.Methods);
        context.Locators.AddRange(metadata.Locators);
        context.Steps.AddRange(metadata.Steps);
        context.Utilities.AddRange(metadata.Utilities);
        context.Relationships.AddRange(metadata.Relationships);
        return context;
    }
}