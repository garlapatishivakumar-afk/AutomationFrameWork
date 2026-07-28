namespace AIAutomationGenerator.Models;

public class AIProviderSettings
{
    public string Provider { get; set; } = "Mock";
    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Endpoint { get; set; } = string.Empty;
    public string DeploymentName { get; set; } = string.Empty;
}
