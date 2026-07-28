using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class PromptOptimizer : IPromptOptimizer
{
    public PromptContext Optimize(
        ContextModel context,
        List<MethodModel> methods,
        List<LocatorModel> locators,
        List<StepDefinitionModel> steps)
    {
        PromptContext prompt = new();

        prompt.Features.AddRange(context.Features);
        prompt.Utilities.AddRange(context.Utilities);
        prompt.Relationships.AddRange(context.Relationships);
        prompt.Methods.AddRange(
            methods
                .OrderByDescending(x => x.Score)
                .Take(20));
        prompt.Locators.AddRange(
            locators
                .OrderByDescending(x => x.Score)
                .Take(20));
        prompt.Steps.AddRange(
            steps
                .OrderByDescending(x => x.Score)
                .Take(20));
        return prompt;
    }
}