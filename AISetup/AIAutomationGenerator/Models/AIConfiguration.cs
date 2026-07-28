namespace AIAutomationGenerator.Models;

public class AIConfiguration
{
    public bool Enabled { get; set; } = true;
    public string Provider { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string BaseUrl { get; set; } = string.Empty;
    public string Organization { get; set; } = string.Empty;
    public double Temperature { get; set; } = 0.7;
    public int MaxTokens { get; set; } = 1024;
    public TimeSpan Timeout { get; set; } = TimeSpan.FromSeconds(30);
}