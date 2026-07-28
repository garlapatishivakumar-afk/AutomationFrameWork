namespace AIAutomationGenerator.Configuration;

public class ScannerSettings
{
    public string RepositoryPath { get; set; } = string.Empty;
    public string OutputFolder { get; set; } = string.Empty;
    public bool ScanFeatures { get; set; } = true;
    public bool ScanStepDefinitions { get; set; } = true;
    public bool ScanPageMethods { get; set; } = true;
    public bool ScanPageObjects { get; set; } = true;
    public bool ScanUtilities { get; set; } = true;
}