namespace AIAutomationGenerator.Models;

/// <summary>V3.0 — Architecture decision: REUSE, EXTEND, or CREATE a framework component.</summary>
public enum ReuseDecisionType
{
    /// <summary>An existing component fully satisfies the requirement. No modification needed.</summary>
    Reuse,

    /// <summary>An existing component is the correct home but needs a targeted addition.</summary>
    Extend,

    /// <summary>No suitable existing component exists; a new one must be created.</summary>
    Create
}

/// <summary>V3.0 — Structured result of an architecture decision for one logical requirement.</summary>
public class ReuseDecision
{
    /// <summary>REUSE / EXTEND / CREATE</summary>
    public ReuseDecisionType Decision { get; set; }

    /// <summary>
    /// Target component name (e.g. "ViewDashboardMethods", "LoginLocators").
    /// For CREATE decisions this is the proposed new component name.
    /// </summary>
    public string TargetComponent { get; set; } = string.Empty;

    /// <summary>Relative file path of the target component within the framework.</summary>
    public string TargetFile { get; set; } = string.Empty;

    /// <summary>PageElements / PageActions / StepDefinitions / Features / Helpers</summary>
    public string ComponentType { get; set; } = string.Empty;

    /// <summary>0.0 – 1.0. Values below 0.5 require human approval.</summary>
    public double Confidence { get; set; }

    /// <summary>Human-readable explanation of why this decision was made.</summary>
    public string Reason { get; set; } = string.Empty;

    /// <summary>Repository evidence that supports the decision (file paths, method names, etc.).</summary>
    public List<string> Evidence { get; set; } = new();

    /// <summary>Alternative candidates that were considered but ranked lower.</summary>
    public List<string> Alternatives { get; set; } = new();

    /// <summary>True when confidence is below threshold or the decision involves destructive changes.</summary>
    public bool RequiresHumanApproval { get; set; }

    /// <summary>The specific method/locator/step name that should be reused or extended.</summary>
    public string ExistingMemberName { get; set; } = string.Empty;
}
