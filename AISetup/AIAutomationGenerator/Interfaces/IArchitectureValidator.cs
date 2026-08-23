using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

/// <summary>
/// V3.0 — Validates that a proposed implementation follows the framework's
/// architecture conventions (layer, naming, namespace, async pattern, etc.).
/// </summary>
public interface IArchitectureValidator
{
    /// <summary>Validates a single change before it is written to disk.</summary>
    ArchitectureValidationResult Validate(ImplementationChange change, string frameworkRoot);

    /// <summary>Validates the complete plan before any file is touched.</summary>
    ArchitectureValidationResult ValidatePlan(ImplementationPlan plan, string frameworkRoot);
}

/// <summary>Result of an architecture validation check.</summary>
public class ArchitectureValidationResult
{
    public bool IsValid { get; set; }
    public List<string> Errors { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
}
