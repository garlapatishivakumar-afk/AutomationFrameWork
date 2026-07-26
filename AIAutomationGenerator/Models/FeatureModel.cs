namespace AIAutomationGenerator.Models;

public class FeatureModel
{
    public string Name { get; set; } = string.Empty;

    public string FilePath { get; set; } = string.Empty;

    public List<string> Scenarios { get; set; } = new();

    public List<string> Tags { get; set; } = new();

    public List<string> Background { get; set; } = new();

    public List<string> ScenarioOutlines { get; set; } = new();

    public List<string> Examples { get; set; } = new();

    public string BusinessArea { get; set; } = string.Empty;

    public List<string> Dependencies { get; set; } = new();

    public List<string> UsedPageObjects { get; set; } = new();

    public List<string> UsedStepDefinitions { get; set; } = new();
}