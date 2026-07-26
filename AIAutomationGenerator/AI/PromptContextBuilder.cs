using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class PromptContextBuilder : IPromptContextBuilder
{
    public PromptContextModel Build(
        ContextModel context,
        List<MethodModel> methods,
        List<LocatorModel> locators,
        List<StepDefinitionModel> steps,
        List<BusinessFlowModel> flows)
    {
        PromptContextModel prompt = new();
        prompt.Methods.AddRange(methods);
        prompt.Locators.AddRange(locators);
        prompt.Steps.AddRange(steps);
        prompt.BusinessFlows.AddRange(flows);
        return prompt;
    }
}