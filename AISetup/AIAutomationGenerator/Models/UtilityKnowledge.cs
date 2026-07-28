namespace AIAutomationGenerator.Models;

public class UtilityKnowledge
{
    public string Name { get; set; } = "";
    public List<string> UsedByPages { get; set; } = [];
    public List<string> UsedByFeatures { get; set; } = [];
}