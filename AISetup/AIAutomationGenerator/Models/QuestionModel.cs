namespace AIAutomationGenerator.Models;

public class QuestionModel
{
    public string Question { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string Target { get; set; } = string.Empty;
    public bool IsMandatory { get; set; }
}