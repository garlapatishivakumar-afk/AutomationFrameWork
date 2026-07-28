using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IPromptOptimizer
{
    PromptContext Optimize(
        ContextModel context,
        List<MethodModel> methods,
        List<LocatorModel> locators,
        List<StepDefinitionModel> steps);
}