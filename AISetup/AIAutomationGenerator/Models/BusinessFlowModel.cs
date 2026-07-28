namespace AIAutomationGenerator.Models;

public class BusinessFlowModel
{
    public string Name { get; set; } = string.Empty;
    public string Verb { get; set; } = string.Empty;
    public string Noun { get; set; } = string.Empty;
    public double Confidence { get; set; }
    public List<string> Evidence { get; set; } = new();

    public List<RecordingActionModel> Actions { get; set; } = new();
}