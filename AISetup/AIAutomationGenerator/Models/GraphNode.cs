namespace AIAutomationGenerator.Models;

public class GraphNode
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string File { get; set; } = string.Empty;
    public Dictionary<string, object> Metadata { get; set; } = new();
}
