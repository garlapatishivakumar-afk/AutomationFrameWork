namespace AIAutomationGenerator.Models;

public class MethodModel
{
    public string Name { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Namespace { get; set; } = string.Empty;
    public string ReturnType { get; set; } = string.Empty;
    public bool IsAsync { get; set; }
    public string FilePath { get; set; } = string.Empty;
    public List<ParameterModel> Parameters { get; set; } = new();
    public string XmlSummary { get; set; } = string.Empty;
    public List<string> CalledMethods { get; set; } = new();
    public List<string> Dependencies { get; set; } = new();
    public string BusinessCategory { get; set; } = string.Empty;
    public List<string> Tags { get; set; } = new();
    public int Score { get; set; }
}