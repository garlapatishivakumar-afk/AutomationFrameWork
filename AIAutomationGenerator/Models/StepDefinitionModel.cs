namespace AIAutomationGenerator.Models;

public class StepDefinitionModel
{
    public string StepText { get; set; } = string.Empty;
    public string MethodName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public int Score { get; set; }
}