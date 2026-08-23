using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IGenerationOrchestrator
{
    /// <summary>V2 generation: produces artifacts in outputFolder.</summary>
    Task GenerateAsync(
        string repositoryPath,
        string recordingPath,
        string outputFolder);

    /// <summary>
    /// V3 architect mode: analyses the repository, decides REUSE/EXTEND/CREATE,
    /// builds an implementation plan, and safely modifies the REAL framework.
    /// </summary>
    Task<ArchitectResult> GenerateArchitectAsync(
        string repositoryPath,
        string recordingPath,
        string frameworkRoot);
}

/// <summary>Result of a V3 architect run.</summary>
public class ArchitectResult
{
    public ImplementationPlan Plan { get; set; } = new();
    public FrameworkModificationResult Modification { get; set; } = new();
    public ArchitectureValidationResult Validation { get; set; } = new() { IsValid = true };
    public bool BuildSucceeded { get; set; }
    public List<string> Decisions { get; set; } = new();
    public int AiCallsUsed { get; set; }
    public string ErrorMessage { get; set; } = string.Empty;
    public bool Success => string.IsNullOrWhiteSpace(ErrorMessage) && Modification.Success;
}