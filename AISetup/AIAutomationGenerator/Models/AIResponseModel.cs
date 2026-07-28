namespace AIAutomationGenerator.Models;

public class AIResponseModel
{
    public string FeatureFile { get; set; } = string.Empty;
    public string PageObjects { get; set; } = string.Empty;
    public string Methods { get; set; } = string.Empty;
    public string StepDefinitions { get; set; } = string.Empty;
    public string Utilities { get; set; } = string.Empty;
    public string ValidationMessages { get; set; } = string.Empty;
    public bool IsMalformed { get; set; }
}
