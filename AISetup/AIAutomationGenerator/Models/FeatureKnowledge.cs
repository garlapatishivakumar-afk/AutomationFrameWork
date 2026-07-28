namespace AIAutomationGenerator.Models;

public class FeatureKnowledge
{
    public string Name { get; set; } = "";
    public string BusinessArea { get; set; } = "";
    public List<string> Steps { get; set; } = [];
    public List<string> Pages { get; set; } = [];
    public List<string> Methods { get; set; } = [];
    public List<string> Locators { get; set; } = [];
    public List<string> SimilarFeatures { get; set; } = [];
    public double Confidence { get; set; }
}