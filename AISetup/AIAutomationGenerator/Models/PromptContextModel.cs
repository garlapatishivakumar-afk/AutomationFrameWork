namespace AIAutomationGenerator.Models;

public class PromptContextModel
{
    public List<MethodModel> Methods { get; set; } = new();
    public List<LocatorModel> Locators { get; set; } = new();
    public List<StepDefinitionModel> Steps { get; set; } = new();
    public List<BusinessFlowModel> BusinessFlows { get; set; } = new();
}