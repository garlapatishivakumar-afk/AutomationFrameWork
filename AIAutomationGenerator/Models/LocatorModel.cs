namespace AIAutomationGenerator.Models;

public class LocatorModel
{
    public string Name { get; set; } = string.Empty;
    public string PageName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string LocatorType { get; set; } = string.Empty;
    public string Selector { get; set; } = string.Empty;
    public int Score { get; set; }
}