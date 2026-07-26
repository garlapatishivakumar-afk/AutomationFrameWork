namespace AIAutomationGenerator.Models;

public class AIRequest
{
    public string Prompt { get; set; } = string.Empty;
    public PromptContext Context { get; set; } = new();
    public List<BusinessFlowModel> BusinessFlows { get; set; } = new();
}