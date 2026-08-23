namespace AIAutomationGenerator.Models;

/// <summary>
/// V3.0 — A single atomic change to the Automation Framework.
/// Produced by ImplementationPlanner; consumed by FrameworkFileModifier.
/// </summary>
public class ImplementationChange
{
    /// <summary>CREATE / MODIFY / EXTEND / REUSE (no file change)</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>Relative path of the target file within the framework root.</summary>
    public string FilePath { get; set; } = string.Empty;

    /// <summary>Target class name (e.g. "ViewDashboardMethods").</summary>
    public string ClassName { get; set; } = string.Empty;

    /// <summary>Target or new method/property/locator name.</summary>
    public string MemberName { get; set; } = string.Empty;

    /// <summary>PageElements / PageActions / StepDefinitions / Features / Helpers</summary>
    public string ComponentType { get; set; } = string.Empty;

    /// <summary>The code content to insert or create. Empty for REUSE actions.</summary>
    public string GeneratedContent { get; set; } = string.Empty;

    /// <summary>Why this change is needed.</summary>
    public string Reason { get; set; } = string.Empty;

    /// <summary>Other changes that must be applied before this one.</summary>
    public List<string> DependsOn { get; set; } = new();

    /// <summary>0.0 – 1.0 risk of this change breaking existing behavior.</summary>
    public double Risk { get; set; }

    /// <summary>If true, this change must be reviewed before being written to disk.</summary>
    public bool ValidationRequired { get; set; }
}
