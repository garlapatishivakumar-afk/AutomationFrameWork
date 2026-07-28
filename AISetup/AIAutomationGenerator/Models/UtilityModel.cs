namespace AIAutomationGenerator.Models;

public class UtilityModel
{
    public string Name { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public List<string> Methods { get; set; } = new();
}