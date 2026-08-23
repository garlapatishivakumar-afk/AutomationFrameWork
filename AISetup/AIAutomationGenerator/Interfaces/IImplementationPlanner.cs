using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

/// <summary>
/// V3.0 — Converts architecture decisions into an ordered ImplementationPlan
/// before any framework file is modified.
/// </summary>
public interface IImplementationPlanner
{
    ImplementationPlan CreatePlan(
        List<BusinessFlowModel> flows,
        List<ReuseDecision> decisions,
        RepositoryMetadata metadata,
        string frameworkRoot);
}
