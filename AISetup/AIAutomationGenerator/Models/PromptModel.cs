namespace AIAutomationGenerator.Models;

public class PromptModel
{
    public string Prompt { get; set; } = string.Empty;
    public string FeatureFile { get; set; } = string.Empty;
    public string ObjectsFile { get; set; } = string.Empty;
    public string MethodsFile { get; set; } = string.Empty;
    public string StepsFile { get; set; } = string.Empty;
    public string FeatureClass { get; set; } = string.Empty;
    public string ObjectsClass { get; set; } = string.Empty;
    public string MethodsClass { get; set; } = string.Empty;
    public string StepsClass { get; set; } = string.Empty;
}