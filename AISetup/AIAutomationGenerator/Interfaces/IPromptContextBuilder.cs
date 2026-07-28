using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IPromptContextBuilder
{
    PromptContextModel Build(
        ContextModel context,
        List<MethodModel> methods,
        List<LocatorModel> locators,
        List<StepDefinitionModel> steps,
        List<BusinessFlowModel> flows);
}