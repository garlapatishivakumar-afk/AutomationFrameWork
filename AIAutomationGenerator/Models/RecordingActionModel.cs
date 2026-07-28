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
    public string PageName { get; set; } = string.Empty;
    public string WindowName { get; set; } = string.Empty;
    public string Url { get; set; } = string.Empty;
    public string FrameName { get; set; } = string.Empty;
    public string VariableName { get; set; } = string.Empty;
    public string ContextType { get; set; } = string.Empty;
    public string LocatorChain { get; set; } = string.Empty;
    public string LocatorExpression { get; set; } = string.Empty;
    public string LocatorArgument { get; set; } = string.Empty;
    public bool IsPopupAction { get; set; }
    public bool IsFrameAction { get; set; }
}