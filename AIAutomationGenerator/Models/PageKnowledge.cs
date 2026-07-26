namespace AIAutomationGenerator.Models;

public class PageKnowledge
{
    public string Name { get; set; } = "";
    public List<string> Methods { get; set; } = [];
    public List<string> Locators { get; set; } = [];
    public List<string> Utilities { get; set; } = [];
    public List<string> RelatedPages { get; set; } = [];
}