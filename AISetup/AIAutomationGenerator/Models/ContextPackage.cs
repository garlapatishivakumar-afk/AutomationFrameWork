namespace AIAutomationGenerator.Models;

public class ContextPackage
{
    public List<ContextItem> Items { get; set; } = [];
    public double Confidence { get; set; }
    public string Fingerprint { get; set; } = string.Empty;
    public string GeneratorVersion { get; set; } = string.Empty;
    public DateTime CreatedOn { get; set; }
}
