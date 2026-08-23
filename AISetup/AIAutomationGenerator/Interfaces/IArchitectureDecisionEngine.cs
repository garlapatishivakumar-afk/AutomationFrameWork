using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

/// <summary>
/// V3.0 — Decides REUSE / EXTEND / CREATE for each component
/// required by a business flow, based on repository intelligence.
/// </summary>
public interface IArchitectureDecisionEngine
{
    /// <summary>
    /// Evaluates the repository candidates and produces one ReuseDecision
    /// for each required component in the business flow.
    /// </summary>
    List<ReuseDecision> Decide(
        List<BusinessFlowModel> flows,
        RepositoryKnowledge knowledge,
        RepositoryMetadata metadata);
}
