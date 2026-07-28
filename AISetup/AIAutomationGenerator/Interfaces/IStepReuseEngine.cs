using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IStepReuseEngine
{
    List<StepDefinitionModel> FindReusableSteps(
        ContextModel context,
        List<BusinessFlowModel> flows);
}