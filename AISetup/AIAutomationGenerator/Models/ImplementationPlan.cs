namespace AIAutomationGenerator.Models;

/// <summary>
/// V3.0 — Complete ordered implementation plan produced before any framework file is modified.
/// Contains all architecture decisions and the sequenced list of changes.
/// </summary>
public class ImplementationPlan
{
    /// <summary>Detected business scenario name.</summary>
    public string Scenario { get; set; } = string.Empty;

    /// <summary>Detected business flow name (verb+noun from BusinessFlowDetector).</summary>
    public string BusinessFlow { get; set; } = string.Empty;

    /// <summary>Architecture decision for each logical requirement in the scenario.</summary>
    public List<ReuseDecision> ArchitectureDecisions { get; set; } = new();

    /// <summary>Ordered list of file changes to apply.</summary>
    public List<ImplementationChange> Changes { get; set; } = new();

    /// <summary>Framework files affected by this plan (for change-impact analysis).</summary>
    public List<string> AffectedFiles { get; set; } = new();

    /// <summary>Validation steps to run after all changes are applied.</summary>
    public List<string> ValidationRequirements { get; set; } = new();

    /// <summary>0.0 – 1.0 overall confidence across all decisions.</summary>
    public double OverallConfidence { get; set; }

    /// <summary>True when at least one decision has RequiresHumanApproval = true.</summary>
    public bool RequiresHumanApproval =>
        ArchitectureDecisions.Any(d => d.RequiresHumanApproval);

    /// <summary>Summary counts for reporting.</summary>
    public int ReuseCount =>
        ArchitectureDecisions.Count(d => d.Decision == ReuseDecisionType.Reuse);

    public int ExtendCount =>
        ArchitectureDecisions.Count(d => d.Decision == ReuseDecisionType.Extend);

    public int CreateCount =>
        ArchitectureDecisions.Count(d => d.Decision == ReuseDecisionType.Create);
}
