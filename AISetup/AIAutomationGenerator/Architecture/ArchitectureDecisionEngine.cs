using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Architecture;

/// <summary>
/// V3.0 — Architecture Decision Engine.
/// Decides REUSE / EXTEND / CREATE for each component required by a business flow.
/// Uses existing V2.0 repository intelligence — does not replace it.
/// </summary>
public class ArchitectureDecisionEngine : IArchitectureDecisionEngine
{
    // Confidence thresholds (configurable via constructor)
    private readonly double reuseThreshold;
    private readonly double extendThreshold;
    private readonly double humanApprovalThreshold;

    public ArchitectureDecisionEngine(
        double reuseThreshold         = 0.75,
        double extendThreshold        = 0.40,
        double humanApprovalThreshold = 0.50)
    {
        this.reuseThreshold         = reuseThreshold;
        this.extendThreshold        = extendThreshold;
        this.humanApprovalThreshold = humanApprovalThreshold;
    }

    public List<ReuseDecision> Decide(
        List<BusinessFlowModel> flows,
        RepositoryKnowledge knowledge,
        RepositoryMetadata metadata)
    {
        var decisions = new List<ReuseDecision>();

        foreach (var flow in flows)
        {
            foreach (var action in flow.Actions)
            {
                var decision = EvaluateAction(action, knowledge, metadata);
                decisions.Add(decision);
            }
        }

        return decisions;
    }

    private ReuseDecision EvaluateAction(
        RecordingActionModel action,
        RepositoryKnowledge knowledge,
        RepositoryMetadata metadata)
    {
        // 1. Search for exact/high-confidence method match
        var methodMatch = FindBestMethodMatch(action, metadata.Methods);
        if (methodMatch.confidence >= reuseThreshold)
        {
            return new ReuseDecision
            {
                Decision          = ReuseDecisionType.Reuse,
                TargetComponent   = methodMatch.className,
                TargetFile        = methodMatch.filePath,
                ComponentType     = "PageActions",
                ExistingMemberName = methodMatch.name,
                Confidence        = methodMatch.confidence,
                Reason            = $"Existing method '{methodMatch.name}' satisfies the requirement.",
                Evidence          = new List<string> { methodMatch.filePath, methodMatch.name },
                RequiresHumanApproval = methodMatch.confidence < humanApprovalThreshold
            };
        }

        // 2. Check for related page that could be extended
        var pageMatch = FindRelatedPage(action, knowledge);
        if (pageMatch.confidence >= extendThreshold && !string.IsNullOrWhiteSpace(pageMatch.name))
        {
            var existingFile = metadata.Methods
                .FirstOrDefault(m => m.ClassName.Equals(pageMatch.name, StringComparison.OrdinalIgnoreCase))
                ?.FilePath ?? string.Empty;

            return new ReuseDecision
            {
                Decision          = ReuseDecisionType.Extend,
                TargetComponent   = pageMatch.name,
                TargetFile        = existingFile,
                ComponentType     = "PageActions",
                Confidence        = pageMatch.confidence,
                Reason            = $"Page '{pageMatch.name}' is the correct location for this behavior.",
                Evidence          = new List<string> { existingFile },
                RequiresHumanApproval = pageMatch.confidence < humanApprovalThreshold
            };
        }

        // 3. CREATE — no suitable existing component found
        string proposedClass    = BuildProposedClassName(action);
        string proposedMember   = BuildProposedMemberName(action);

        return new ReuseDecision
        {
            Decision          = ReuseDecisionType.Create,
            TargetComponent   = proposedClass,
            TargetFile        = string.Empty, // FrameworkLayerMapper will resolve this
            ComponentType     = "PageActions",
            ExistingMemberName = proposedMember,
            Confidence        = 0.6,
            Reason            = "No suitable existing component found.",
            Evidence          = new List<string>(),
            RequiresHumanApproval = true
        };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    private static (string name, string className, string filePath, double confidence)
        FindBestMethodMatch(RecordingActionModel action, List<MethodModel> methods)
    {
        if (methods.Count == 0)
            return (string.Empty, string.Empty, string.Empty, 0);

        double bestScore = 0;
        MethodModel? best = null;

        foreach (var method in methods)
        {
            double score = 0;

            if (Contains(method.Name, action.ActionType))         score += 0.30;
            if (Contains(method.Name, action.LocatorArgument))    score += 0.35;
            if (Contains(method.Name, action.LocatorValue))       score += 0.25;
            if (Contains(method.ClassName, action.PageName))      score += 0.20;
            if (Contains(method.BusinessCategory, action.ActionType)) score += 0.15;

            // Cap at 1.0
            score = Math.Min(score, 1.0);

            if (score > bestScore)
            {
                bestScore = score;
                best = method;
            }
        }

        if (best == null) return (string.Empty, string.Empty, string.Empty, 0);
        return (best.Name, best.ClassName, best.FilePath, bestScore);
    }

    private static (string name, double confidence)
        FindRelatedPage(RecordingActionModel action, RepositoryKnowledge knowledge)
    {
        if (string.IsNullOrWhiteSpace(action.PageName))
            return (string.Empty, 0);

        foreach (var page in knowledge.Pages)
        {
            if (Contains(page.Name, action.PageName))
                return (page.Name, 0.65);
        }

        return (string.Empty, 0);
    }

    private static string BuildProposedClassName(RecordingActionModel action)
    {
        if (!string.IsNullOrWhiteSpace(action.PageName))
            return $"{ToPascal(action.PageName)}Methods";
        return "GeneratedMethods";
    }

    private static string BuildProposedMemberName(RecordingActionModel action)
    {
        string verb   = string.IsNullOrWhiteSpace(action.ActionType) ? "Perform" : ToPascal(action.ActionType);
        string target = string.IsNullOrWhiteSpace(action.LocatorArgument)
            ? (string.IsNullOrWhiteSpace(action.LocatorValue) ? "Element" : ToPascal(action.LocatorValue))
            : ToPascal(action.LocatorArgument);
        return $"{verb}{target}Async";
    }

    private static string ToPascal(string s) =>
        string.IsNullOrWhiteSpace(s)
            ? string.Empty
            : char.ToUpperInvariant(s[0]) + s.Substring(1);

    private static bool Contains(string source, string token) =>
        !string.IsNullOrWhiteSpace(source) &&
        !string.IsNullOrWhiteSpace(token) &&
        source.Contains(token, StringComparison.OrdinalIgnoreCase);
}
