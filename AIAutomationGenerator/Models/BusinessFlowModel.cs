namespace AIAutomationGenerator.Models;

public class BusinessFlowModel
{
    public string Name { get; set; } = string.Empty;

    public List<RecordingActionModel> Actions { get; set; } = new();
}