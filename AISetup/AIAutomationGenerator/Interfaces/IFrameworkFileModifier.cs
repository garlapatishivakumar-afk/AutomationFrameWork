using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

/// <summary>
/// V3.0 — Safely modifies or creates Automation Framework files
/// based on an approved ImplementationPlan.
/// Never blindly replaces an entire file.
/// </summary>
public interface IFrameworkFileModifier
{
    /// <summary>
    /// Applies a single approved change to the framework.
    /// Returns false if validation fails; the original file is never touched.
    /// </summary>
    Task<bool> ApplyAsync(ImplementationChange change, string frameworkRoot);

    /// <summary>
    /// Applies all changes in an approved plan in dependency order.
    /// Aborts on first validation failure.
    /// </summary>
    Task<FrameworkModificationResult> ApplyPlanAsync(ImplementationPlan plan, string frameworkRoot);
}

/// <summary>Summary result of applying a complete ImplementationPlan.</summary>
public class FrameworkModificationResult
{
    public bool Success { get; set; }
    public List<string> AppliedFiles { get; set; } = new();
    public List<string> SkippedFiles { get; set; } = new();
    public List<string> Errors { get; set; } = new();
}
