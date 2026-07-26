namespace AIAutomationGenerator.Models;

public class RecordingActionModel
{
    public string ActionType { get; set; } = string.Empty;
    public string Target { get; set; } = string.Empty;
    public int Sequence { get; set; }
    public string LocatorType { get; set; } = string.Empty;
    public string LocatorValue { get; set; } = string.Empty;
    public string InputValue { get; set; } = string.Empty;
    public string Assertion { get; set; } = string.Empty;
    public string RawCode { get; set; } = string.Empty;
}