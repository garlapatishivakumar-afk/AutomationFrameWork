using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Architecture;

/// <summary>
/// V3.0 — Converts architecture decisions into an ordered ImplementationPlan
/// before any framework file is modified.
/// Uses V2.0 RepositoryGraphBuilder (via metadata) for change-impact analysis.
/// </summary>
public class ImplementationPlanner : IImplementationPlanner
{
    private readonly IFrameworkLayerMapper layerMapper;

    public ImplementationPlanner(IFrameworkLayerMapper layerMapper)
    {
        this.layerMapper = layerMapper;
    }

    public ImplementationPlan CreatePlan(
        List<BusinessFlowModel> flows,
        List<ReuseDecision> decisions,
        RepositoryMetadata metadata,
        string frameworkRoot)
    {
        var plan = new ImplementationPlan
        {
            Scenario      = flows.FirstOrDefault()?.Name ?? "Unknown Scenario",
            BusinessFlow  = flows.FirstOrDefault()?.Name ?? string.Empty,
            ArchitectureDecisions = decisions
        };

        // Deduplicate decisions (same component referenced multiple times)
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        // Track CREATE file paths to prevent duplicate CREATE for the same target file
        var createFiles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var decision in decisions)
        {
            var key = $"{decision.Decision}:{decision.TargetComponent}:{decision.ExistingMemberName}";
            if (!seen.Add(key))
                continue;

            switch (decision.Decision)
            {
                case ReuseDecisionType.Reuse:
                    // No file change — record as informational REUSE step
                    plan.Changes.Add(new ImplementationChange
                    {
                        Action        = "REUSE",
                        FilePath      = decision.TargetFile,
                        ClassName     = decision.TargetComponent,
                        MemberName    = decision.ExistingMemberName,
                        ComponentType = decision.ComponentType,
                        Reason        = decision.Reason,
                        Risk          = 0.0,
                        ValidationRequired = false
                    });
                    break;

                case ReuseDecisionType.Extend:
                {
                    var targetFile = ResolveTargetFile(decision, metadata, frameworkRoot);
                    plan.Changes.Add(new ImplementationChange
                    {
                        Action        = "EXTEND",
                        FilePath      = targetFile,
                        ClassName     = decision.TargetComponent,
                        MemberName    = decision.ExistingMemberName,
                        ComponentType = decision.ComponentType,
                        Reason        = decision.Reason,
                        Risk          = 0.3,
                        ValidationRequired = true
                    });
                    if (!plan.AffectedFiles.Contains(targetFile))
                        plan.AffectedFiles.Add(targetFile);
                    break;
                }

                case ReuseDecisionType.Create:
                {
                    var layerMapping = layerMapper.Map(
                        decision.ComponentType,
                        decision.ExistingMemberName,
                        metadata);

                    string fileName  = BuildFileName(decision.TargetComponent, layerMapping);
                    string fullPath  = Path.Combine(frameworkRoot, layerMapping.FolderPath, fileName);

                    // Skip if we already have a CREATE planned for this exact file
                    if (!createFiles.Add(fullPath))
                        break;

                    plan.Changes.Add(new ImplementationChange
                    {
                        Action        = "CREATE",
                        FilePath      = fullPath,
                        ClassName     = decision.TargetComponent,
                        MemberName    = decision.ExistingMemberName,
                        ComponentType = layerMapping.Layer,
                        Reason        = decision.Reason,
                        Risk          = 0.5,
                        ValidationRequired = true
                    });
                    plan.AffectedFiles.Add(fullPath);
                    break;
                }
            }
        }

        // Order changes: REUSE → EXTEND → CREATE (dependencies satisfied first)
        plan.Changes = plan.Changes
            .OrderBy(c => c.Action == "REUSE" ? 0 : c.Action == "EXTEND" ? 1 : 2)
            .ToList();

        plan.ValidationRequirements.Add("dotnet build");
        if (plan.Changes.Any(c => c.Action != "REUSE"))
            plan.ValidationRequirements.Add("Architecture validation");

        plan.OverallConfidence = decisions.Count == 0
            ? 0
            : Math.Round(decisions.Average(d => d.Confidence), 2);

        return plan;
    }

    private static string ResolveTargetFile(
        ReuseDecision decision,
        RepositoryMetadata metadata,
        string frameworkRoot)
    {
        if (!string.IsNullOrWhiteSpace(decision.TargetFile) && File.Exists(decision.TargetFile))
            return decision.TargetFile;

        // Try to find the file via scanned methods
        var method = metadata.Methods.FirstOrDefault(m =>
            m.ClassName.Equals(decision.TargetComponent, StringComparison.OrdinalIgnoreCase));

        if (method != null && !string.IsNullOrWhiteSpace(method.FilePath))
            return method.FilePath;

        return decision.TargetFile;
    }

    private static string BuildFileName(string className, FrameworkLayerMapping layer)
    {
        string convention = layer.NamingConvention;
        if (convention.Contains("{Page}"))
            return convention.Replace("{Page}", className.Replace("Methods", "").Replace("Objects", "").Replace("Steps", ""));
        if (convention.Contains("{Name}"))
            return convention.Replace("{Name}", className);
        return $"{className}.cs";
    }
}
