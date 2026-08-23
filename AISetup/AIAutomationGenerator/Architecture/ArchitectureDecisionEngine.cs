using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Architecture;

/// <summary>
/// V3.1 — Architecture Decision Engine.
/// Decides REUSE / EXTEND / CREATE for each component required by a business flow.
/// Uses existing V2.0 repository intelligence — does not replace it.
/// Evaluates all relevant framework layers: PageActions, PageElements, StepDefinitions.
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
                // L1 (V3.2): Infer a meaningful page context when RecordingParser produced
                // only the generic Codegen variable name (e.g. "page").
                // A resolved copy is used locally — the original flow action is not mutated.
                var resolvedAction = InferPageContext(action, metadata);

                // ── Layer 1: PageActions ─────────────────────────────────────
                decisions.Add(EvaluateAction(resolvedAction, knowledge, metadata));

                // ── Layer 2: PageElements ────────────────────────────────────
                // Only when the action has a locator signal and locator data exists.
                bool hasLocatorSignal = !string.IsNullOrWhiteSpace(resolvedAction.LocatorType)
                    || !string.IsNullOrWhiteSpace(resolvedAction.LocatorArgument)
                    || !string.IsNullOrWhiteSpace(resolvedAction.LocatorValue);
                if (metadata.Locators.Count > 0 && hasLocatorSignal)
                {
                    var locatorDecision = EvaluateLocatorLayer(resolvedAction, metadata);
                    if (locatorDecision != null)
                        decisions.Add(locatorDecision);
                }

                // ── Layer 3: StepDefinitions ─────────────────────────────────
                // Only when step definition data exists in the repository.
                if (metadata.Steps.Count > 0)
                {
                    var stepDecision = EvaluateStepLayer(resolvedAction, metadata);
                    if (stepDecision != null)
                        decisions.Add(stepDecision);
                }
            }
        }

        return decisions;
    }

    private ReuseDecision EvaluateAction(
        RecordingActionModel action,
        RepositoryKnowledge knowledge,
        RepositoryMetadata metadata)
    {
        // L3 (V3.2): restrict PageActions matching to genuine PageActions methods.
        // StepDefinitions methods (identifiable by file path containing step-definition
        // markers, or by the [Given]/[When]/[Then] tag pattern) must not be PageActions candidates.
        var pageActionMethods = metadata.Methods
            .Where(IsPageActionsMethod)
            .ToList();

        // 1. Search for exact/high-confidence method match (PageActions only)
        var methodMatch = FindBestMethodMatch(action, pageActionMethods);
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

    /// <summary>
    /// V3.2 — L3: Returns true when a method belongs to the PageActions layer.
    /// Excludes methods from StepDefinitions files (identified by folder name,
    /// namespace, or Reqnroll binding attribute tags — no hardcoded class names).
    /// </summary>
    private static bool IsPageActionsMethod(MethodModel method)
    {
        // Exclude methods whose file resides in a StepDefinitions folder
        if (!string.IsNullOrWhiteSpace(method.FilePath))
        {
            string path = method.FilePath.Replace('\\', '/');
            if (path.Contains("/StepDefinitions/",  StringComparison.OrdinalIgnoreCase) ||
                path.Contains("/Steps/",             StringComparison.OrdinalIgnoreCase))
                return false;
        }

        // Exclude methods in a StepDefinitions namespace
        if (!string.IsNullOrWhiteSpace(method.Namespace) &&
            method.Namespace.Contains("StepDefinition", StringComparison.OrdinalIgnoreCase))
            return false;

        // Exclude methods tagged with Reqnroll/SpecFlow step binding attributes
        if (method.Tags.Any(t =>
            t.Equals("Given",    StringComparison.OrdinalIgnoreCase) ||
            t.Equals("When",     StringComparison.OrdinalIgnoreCase) ||
            t.Equals("Then",     StringComparison.OrdinalIgnoreCase) ||
            t.Equals("And",      StringComparison.OrdinalIgnoreCase) ||
            t.Equals("But",      StringComparison.OrdinalIgnoreCase) ||
            t.Equals("Binding",  StringComparison.OrdinalIgnoreCase)))
            return false;

        return true;
    }

    /// <summary>
    /// V3.2 — L1: Infers a meaningful page context for a recorded action that
    /// only carries the Playwright Codegen default variable name ("page").
    ///
    /// Strategy (in priority order):
    ///   1. If PageName is already meaningful (contains uppercase letters), return as-is.
    ///   2. Match the action's locator signals against scanned PageElements locators.
    ///      Derive the page name from the owning PageElements class (e.g. "ViewDashboardObjects"
    ///      → "ViewDashboard").
    ///   3. Match the action's role name / locator argument against scanned step definitions
    ///      to derive the page file they belong to (e.g. "ViewDashboardSteps" → "ViewDashboard").
    ///   4. If nothing can be inferred safely, return the action unchanged.
    ///
    /// A shallow copy is returned so the original action is never mutated.
    /// </summary>
    private static RecordingActionModel InferPageContext(
        RecordingActionModel action,
        RepositoryMetadata metadata)
    {
        // Already has meaningful PageName (has uppercase → not "page" / "page2" etc.)
        if (!string.IsNullOrWhiteSpace(action.PageName) &&
            action.PageName.Any(char.IsUpper))
            return action;

        string roleNameRaw      = ExtractGetByRoleName(action.Target ?? string.Empty);
        string roleNameNoSpaces = roleNameRaw.Replace(" ", "");

        // ── Strategy A: match via PageElements locators ─────────────────────
        if (metadata.Locators.Count > 0)
        {
            LocatorModel? matched = null;
            double bestScore = 0;

            foreach (var loc in metadata.Locators)
            {
                double score = 0;

                if (!string.IsNullOrWhiteSpace(roleNameNoSpaces) && Contains(loc.Name, roleNameNoSpaces))
                    score += 0.70;
                if (!string.IsNullOrWhiteSpace(action.LocatorValue) &&
                    !string.IsNullOrWhiteSpace(loc.Selector) &&
                    string.Equals(loc.Selector.Trim(), action.LocatorValue.Trim(), StringComparison.OrdinalIgnoreCase))
                    score += 0.80;
                if (Contains(loc.Name, action.LocatorArgument))
                    score += 0.20;

                score = Math.Min(score, 1.0);
                if (score > bestScore) { bestScore = score; matched = loc; }
            }

            // Require a confident match (≥ 0.60) before inferring page context
            if (bestScore >= 0.60 && matched != null && !string.IsNullOrWhiteSpace(matched.PageName))
            {
                // Strip common suffixes to get the canonical page name
                // e.g. "ViewDashboardObjects" → "ViewDashboard"
                string page = StripPageElementsSuffix(matched.PageName);
                if (!string.IsNullOrWhiteSpace(page) && page.Any(char.IsUpper))
                    return ShallowCopyWithPageName(action, page);
            }
        }

        // ── Strategy B: match via StepDefinitions file names ────────────────
        if (metadata.Steps.Count > 0 && !string.IsNullOrWhiteSpace(roleNameNoSpaces))
        {
            var matchedStep = metadata.Steps.FirstOrDefault(s =>
                Contains(s.MethodName, roleNameNoSpaces) ||
                Contains(s.StepText,   roleNameRaw));

            if (matchedStep != null && !string.IsNullOrWhiteSpace(matchedStep.FilePath))
            {
                string page = StripStepDefinitionsSuffix(Path.GetFileNameWithoutExtension(matchedStep.FilePath));
                if (!string.IsNullOrWhiteSpace(page) && page.Any(char.IsUpper))
                    return ShallowCopyWithPageName(action, page);
            }
        }

        // Cannot infer safely — return original
        return action;
    }

    /// Creates a shallow copy of the action with a new PageName value.
    private static RecordingActionModel ShallowCopyWithPageName(RecordingActionModel src, string pageName) =>
        new RecordingActionModel
        {
            ActionType       = src.ActionType,
            Target           = src.Target,
            Sequence         = src.Sequence,
            LocatorType      = src.LocatorType,
            LocatorValue     = src.LocatorValue,
            InputValue       = src.InputValue,
            Assertion        = src.Assertion,
            RawCode          = src.RawCode,
            PageName         = pageName,
            WindowName       = src.WindowName,
            Url              = src.Url,
            FrameName        = src.FrameName,
            VariableName     = src.VariableName,
            ContextType      = src.ContextType,
            LocatorChain     = src.LocatorChain,
            LocatorExpression = src.LocatorExpression,
            LocatorArgument  = src.LocatorArgument,
            IsPopupAction    = src.IsPopupAction,
            IsFrameAction    = src.IsFrameAction
        };

    /// Removes common PageElements class suffixes to yield a canonical page name.
    private static string StripPageElementsSuffix(string className)
    {
        foreach (var suffix in new[] { "Objects", "Elements", "Locators", "Page" })
        {
            if (className.EndsWith(suffix, StringComparison.OrdinalIgnoreCase) &&
                className.Length > suffix.Length)
                return className[..^suffix.Length];
        }
        return className;
    }

    /// Removes common StepDefinitions class suffixes to yield a canonical page name.
    private static string StripStepDefinitionsSuffix(string className)
    {
        foreach (var suffix in new[] { "Steps", "StepDefinitions", "Bindings" })
        {
            if (className.EndsWith(suffix, StringComparison.OrdinalIgnoreCase) &&
                className.Length > suffix.Length)
                return className[..^suffix.Length];
        }
        return className;
    }

    private static (string name, string className, string filePath, double confidence)
        FindBestMethodMatch(RecordingActionModel action, List<MethodModel> methods)
    {
        if (methods.Count == 0)
            return (string.Empty, string.Empty, string.Empty, 0);

        // Extract the 'name:' option from the raw line (e.g. getByRole('button', { name: 'Search Queue' }))
        // RecordingParser.LocatorArgument captures the ROLE TYPE ('button'), not the name option.
        // We need the name value for matching method names like "ClickSearchQueueAsync".
        string roleNameRaw = ExtractGetByRoleName(action.Target ?? string.Empty);
        string roleNameNoSpaces = roleNameRaw.Replace(" ", "");

        double bestScore = 0;
        MethodModel? best = null;

        foreach (var method in methods)
        {
            double score = 0;

            // Signal 1: ActionType match (e.g. "Click" → "ClickSearchQueueAsync")
            if (Contains(method.Name, action.ActionType))         score += 0.30;

            // Signal 2: getByRole name option (space-stripped) in method name
            // e.g. "SearchQueue" found in "ClickSearchQueueAsync" → strong match
            if (!string.IsNullOrWhiteSpace(roleNameNoSpaces) &&
                Contains(method.Name, roleNameNoSpaces))          score += 0.40;

            // Signal 3: Original LocatorArgument in method name (preserved weight)
            if (Contains(method.Name, action.LocatorArgument))    score += 0.35;

            // Signal 4: LocatorValue in method name
            if (Contains(method.Name, action.LocatorValue))       score += 0.25;

            // Signal 5: Page name match on class name
            if (Contains(method.ClassName, action.PageName))      score += 0.20;

            // Signal 6: Business category
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

    /// <summary>
    /// Extracts the 'name:' option value from a getByRole expression in the raw line.
    /// e.g. "getByRole('button', { name: 'Search Queue' })" → "Search Queue"
    /// </summary>
    private static string ExtractGetByRoleName(string rawLine)
    {
        if (string.IsNullOrWhiteSpace(rawLine)) return string.Empty;
        var match = System.Text.RegularExpressions.Regex.Match(
            rawLine,
            @"name\s*:\s*['""]([^'""]+)['""]",
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return match.Success ? match.Groups[1].Value.Trim() : string.Empty;
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

    // ──────────────────────────────────────────────────────────────────────────
    // V3.1 — PageElements layer evaluation
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Evaluates whether a recorded locator already exists (REUSE), belongs to an
    /// existing PageElements file that needs a new locator (EXTEND), or requires a
    /// new PageElements class to be created (CREATE).
    /// Returns null when no meaningful locator signal exists (avoids noise).
    /// </summary>
    private ReuseDecision? EvaluateLocatorLayer(RecordingActionModel action, RepositoryMetadata metadata)
    {
        string roleNameRaw      = ExtractGetByRoleName(action.Target ?? string.Empty);
        string roleNameNoSpaces = roleNameRaw.Replace(" ", "");

        double bestScore = 0;
        LocatorModel? best = null;

        foreach (var loc in metadata.Locators)
        {
            double score = 0;

            // Signal 1: getByRole name option (space-stripped) found in locator name
            if (!string.IsNullOrWhiteSpace(roleNameNoSpaces) && Contains(loc.Name, roleNameNoSpaces))
                score += 0.55;

            // Signal 2a: Exact selector match — identical selector means same element
            if (!string.IsNullOrWhiteSpace(action.LocatorValue) &&
                !string.IsNullOrWhiteSpace(loc.Selector) &&
                string.Equals(loc.Selector, action.LocatorValue, StringComparison.OrdinalIgnoreCase))
                score += 0.75;

            // Signal 2b: Partial selector containment (weaker — one is substring of the other)
            else if (!string.IsNullOrWhiteSpace(action.LocatorValue) &&
                     !string.IsNullOrWhiteSpace(loc.Selector) &&
                     (loc.Selector.Contains(action.LocatorValue, StringComparison.OrdinalIgnoreCase) ||
                      action.LocatorValue.Contains(loc.Selector, StringComparison.OrdinalIgnoreCase)))
                score += 0.40;

            // Signal 3: LocatorArgument (role type) found in locator name — weak but additive
            if (Contains(loc.Name, action.LocatorArgument))
                score += 0.25;

            score = Math.Min(score, 1.0);
            if (score > bestScore) { bestScore = score; best = loc; }
        }

        // REUSE: an existing locator satisfies the element requirement
        if (bestScore >= reuseThreshold && best != null)
        {
            string className = Path.GetFileNameWithoutExtension(best.FilePath);
            return new ReuseDecision
            {
                Decision           = ReuseDecisionType.Reuse,
                TargetComponent    = className,
                TargetFile         = best.FilePath,
                ComponentType      = "PageElements",
                ExistingMemberName = best.Name,
                Confidence         = bestScore,
                Reason             = $"Existing locator '{best.Name}' satisfies the element requirement.",
                Evidence           = new List<string> { best.FilePath, best.Name },
                RequiresHumanApproval = bestScore < humanApprovalThreshold
            };
        }

        // Look for a related PageElements file to EXTEND (only when PageName is meaningful,
        // i.e. has uppercase letters indicating a real class/page name, not just "page" variable).
        bool isPageNameMeaningful = !string.IsNullOrWhiteSpace(action.PageName) &&
            action.PageName.Any(char.IsUpper);
        string? relatedFile = isPageNameMeaningful
            ? metadata.Locators
                .Where(l => Contains(l.PageName, action.PageName) ||
                            Contains(l.FilePath, action.PageName))
                .Select(l => l.FilePath)
                .FirstOrDefault()
            : null;

        // EXTEND: a related PageElements file exists but does not contain this locator
        if (!string.IsNullOrWhiteSpace(relatedFile))
        {
            string className = Path.GetFileNameWithoutExtension(relatedFile);
            return new ReuseDecision
            {
                Decision          = ReuseDecisionType.Extend,
                TargetComponent   = className,
                TargetFile        = relatedFile,
                ComponentType     = "PageElements",
                Confidence        = 0.55,
                Reason            = $"PageElements file '{Path.GetFileName(relatedFile)}' is the correct location for this locator.",
                Evidence          = new List<string> { relatedFile },
                RequiresHumanApproval = true
            };
        }

        // CREATE: emit only when there is enough signal to justify a new PageElements entry.
        // (bestScore >= extendThreshold means a partial match was found but no exact file)
        // (isPageNameMeaningful means the action carries explicit page context)
        if (bestScore >= extendThreshold || isPageNameMeaningful)
        {
            string proposedClass  = BuildProposedLocatorClassName(action);
            string proposedMember = BuildProposedLocatorName(action, roleNameRaw);
            return new ReuseDecision
            {
                Decision           = ReuseDecisionType.Create,
                TargetComponent    = proposedClass,
                TargetFile         = string.Empty, // FrameworkLayerMapper resolves this
                ComponentType      = "PageElements",
                ExistingMemberName = proposedMember,
                Confidence         = 0.50,
                Reason             = "No suitable existing locator found; a new PageElements entry is required.",
                Evidence           = new List<string>(),
                RequiresHumanApproval = true
            };
        }

        return null; // No meaningful PageElements signal — skip this layer for this action
    }

    // ──────────────────────────────────────────────────────────────────────────
    // V3.1 — StepDefinitions layer evaluation
    // ──────────────────────────────────────────────────────────────────────────

    /// <summary>
    /// Evaluates whether a recorded action corresponds to an existing step definition
    /// (REUSE), a step file that should be extended (EXTEND), or a new step file that
    /// should be created (CREATE).
    /// Returns null when confidence is too low to justify any decision.
    /// </summary>
    private ReuseDecision? EvaluateStepLayer(RecordingActionModel action, RepositoryMetadata metadata)
    {
        string roleNameRaw      = ExtractGetByRoleName(action.Target ?? string.Empty);
        string roleNameNoSpaces = roleNameRaw.Replace(" ", "");

        double bestScore = 0;
        StepDefinitionModel? best = null;

        foreach (var step in metadata.Steps)
        {
            double score = 0;

            // Signal 1: ActionType keyword in method name or step text
            if (Contains(step.MethodName, action.ActionType) ||
                Contains(step.StepText,   action.ActionType))
                score += 0.30;

            // Signal 2: getByRole name found in method name (space-stripped) or step text
            // This is the strongest signal — specific element name precisely identifies the step.
            if (!string.IsNullOrWhiteSpace(roleNameNoSpaces) && Contains(step.MethodName, roleNameNoSpaces))
                score += 0.50;
            else if (!string.IsNullOrWhiteSpace(roleNameRaw) && Contains(step.StepText, roleNameRaw))
                score += 0.45;

            score = Math.Min(score, 1.0);
            if (score > bestScore) { bestScore = score; best = step; }
        }

        // REUSE: an existing step definition satisfies the requirement
        if (bestScore >= reuseThreshold && best != null)
        {
            string className = Path.GetFileNameWithoutExtension(best.FilePath);
            return new ReuseDecision
            {
                Decision           = ReuseDecisionType.Reuse,
                TargetComponent    = className,
                TargetFile         = best.FilePath,
                ComponentType      = "StepDefinitions",
                ExistingMemberName = best.MethodName,
                Confidence         = bestScore,
                Reason             = $"Existing step '{best.MethodName}' satisfies the requirement.",
                Evidence           = new List<string> { best.FilePath, best.MethodName },
                RequiresHumanApproval = bestScore < humanApprovalThreshold
            };
        }

        // Look for a related StepDefinitions file to EXTEND.
        bool isPageNameMeaningful = !string.IsNullOrWhiteSpace(action.PageName) &&
            action.PageName.Any(char.IsUpper);
        string? relatedFile = isPageNameMeaningful
            ? metadata.Steps
                .Where(s => Contains(s.FilePath, action.PageName))
                .Select(s => s.FilePath)
                .FirstOrDefault()
            : null;

        // EXTEND: a related step file exists but does not contain this step
        if (!string.IsNullOrWhiteSpace(relatedFile))
        {
            string className = Path.GetFileNameWithoutExtension(relatedFile);
            return new ReuseDecision
            {
                Decision          = ReuseDecisionType.Extend,
                TargetComponent   = className,
                TargetFile        = relatedFile,
                ComponentType     = "StepDefinitions",
                Confidence        = 0.55,
                Reason            = $"StepDefinitions file '{Path.GetFileName(relatedFile)}' is the correct location for this step.",
                Evidence          = new List<string> { relatedFile },
                RequiresHumanApproval = true
            };
        }

        // CREATE: emit only when there's a meaningful page context with no existing step file.
        if (isPageNameMeaningful)
        {
            string proposedClass  = BuildProposedStepClassName(action);
            string proposedMember = BuildProposedStepName(action, roleNameRaw);
            return new ReuseDecision
            {
                Decision           = ReuseDecisionType.Create,
                TargetComponent    = proposedClass,
                TargetFile         = string.Empty, // FrameworkLayerMapper resolves this
                ComponentType      = "StepDefinitions",
                ExistingMemberName = proposedMember,
                Confidence         = 0.50,
                Reason             = "No suitable existing step definition found; a new StepDefinitions file is required.",
                Evidence           = new List<string>(),
                RequiresHumanApproval = true
            };
        }

        return null; // Insufficient signal — skip StepDefinitions layer for this action
    }

    // ──────────────────────────────────────────────────────────────────────────
    // V3.1 — Proposed name builders for new layers
    // ──────────────────────────────────────────────────────────────────────────

    private static string BuildProposedLocatorClassName(RecordingActionModel action)
    {
        if (!string.IsNullOrWhiteSpace(action.PageName) && action.PageName.Any(char.IsUpper))
            return $"{ToPascal(action.PageName)}Objects";
        return "GeneratedObjects";
    }

    private static string BuildProposedLocatorName(RecordingActionModel action, string roleNameRaw)
    {
        string name = !string.IsNullOrWhiteSpace(roleNameRaw)
            ? roleNameRaw.Replace(" ", "")
            : (!string.IsNullOrWhiteSpace(action.LocatorArgument)
                ? ToPascal(action.LocatorArgument)
                : (!string.IsNullOrWhiteSpace(action.LocatorValue)
                    ? ToPascal(action.LocatorValue.TrimStart('#', '.'))
                    : "Element"));
        return $"{name}Locator";
    }

    private static string BuildProposedStepClassName(RecordingActionModel action)
    {
        if (!string.IsNullOrWhiteSpace(action.PageName) && action.PageName.Any(char.IsUpper))
            return $"{ToPascal(action.PageName)}Steps";
        return "GeneratedSteps";
    }

    private static string BuildProposedStepName(RecordingActionModel action, string roleNameRaw)
    {
        string verb = string.IsNullOrWhiteSpace(action.ActionType) ? "Perform" : ToPascal(action.ActionType);
        string name = !string.IsNullOrWhiteSpace(roleNameRaw)
            ? roleNameRaw.Replace(" ", "")
            : (!string.IsNullOrWhiteSpace(action.LocatorArgument)
                ? ToPascal(action.LocatorArgument)
                : "Action");
        return $"WhenUser{verb}s{name}";
    }
}
