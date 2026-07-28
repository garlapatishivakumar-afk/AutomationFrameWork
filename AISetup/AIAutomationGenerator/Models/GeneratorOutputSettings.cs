namespace AIAutomationGenerator.Models;

public enum ExistingFileStrategy
{
    Replace,
    CreateCopy,
    Cancel
}

public class GeneratorOutputSettings
{
    public string FeaturesFolder { get; set; } = string.Empty;

    public string PageElementsFolder { get; set; } = string.Empty;

    public string PageActionsFolder { get; set; } = string.Empty;

    public string StepDefinitionsFolder { get; set; } = string.Empty;

    public string UtilitiesFolder { get; set; } = string.Empty;

    public string ReportsFolder { get; set; } = string.Empty;

    public bool AutoDetectFoldersFromMetadata { get; set; } = true;

    public ExistingFileStrategy ExistingFileStrategy { get; set; } = ExistingFileStrategy.Replace;
}