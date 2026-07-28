using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class ContextFilter : IContextFilter
{
    public ContextModel Filter(
        ContextModel context,
        List<BusinessFlowModel> flows)
    {
        ContextModel filtered = new();

        var relevantMethods = context.Methods
            .OrderByDescending(x => x.Score)
            .Take(10)
            .ToList();

        var relevantLocators = context.Locators
            .OrderByDescending(x => x.Score)
            .Take(10)
            .ToList();

        var relevantSteps = context.Steps
            .OrderByDescending(x => x.Score)
            .Take(5)
            .ToList();

        var relevantUtilities = context.Utilities
            .Take(5)
            .ToList();

        var relevantPages = context.Features
            .Take(5)
            .ToList();

        filtered.Features.AddRange(relevantPages);
        filtered.Methods.AddRange(relevantMethods);
        filtered.Locators.AddRange(relevantLocators);
        filtered.Steps.AddRange(relevantSteps);
        filtered.Utilities.AddRange(relevantUtilities);
        filtered.Relationships.AddRange(context.Relationships.Take(10));

        return filtered;
    }
}