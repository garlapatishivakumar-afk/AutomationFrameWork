using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Architecture;

/// <summary>
/// V3.0 — Validates that a proposed implementation follows the Automation Framework's
/// architecture conventions. Reuses V2.0 ScriptValidator for content checks; adds
/// structural/layer/convention checks on top.
/// </summary>
public class ArchitectureValidator : IArchitectureValidator
{
    private readonly IScriptValidator scriptValidator;

    // Framework convention rules derived from discovered structure
    private static readonly Dictionary<string, string[]> LayerRequirements =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["PageElements"]    = ["ILocator", "AutomationFrameWork.PageElements"],
            ["PageActions"]     = ["async Task", "AutomationFrameWork.PageActions"],
            ["StepDefinitions"] = ["[Binding]", "AutomationFrameWork.StepDefinitions"],
            ["Features"]        = ["Feature:", "Scenario"],
            ["Helpers"]         = []
        };

    private static readonly string[] ForbiddenPatterns =
    [
        "Thread.Sleep(",
        "Task.Delay(",     // should use framework wait utilities
        "hardcoded",       // catches obvious violations
    ];

    private static readonly string[] HardcodedUrlPatterns =
    [
        "http://",
        "https://"
    ];

    public ArchitectureValidator(IScriptValidator scriptValidator)
    {
        this.scriptValidator = scriptValidator;
    }

    public ArchitectureValidationResult Validate(ImplementationChange change, string frameworkRoot)
    {
        var result = new ArchitectureValidationResult { IsValid = true };

        if (change.Action == "REUSE")
            return result; // Nothing to validate for a pure reuse

        // 1. Validate generated content with V2.0 ScriptValidator
        if (!string.IsNullOrWhiteSpace(change.GeneratedContent))
        {
            var scriptResult = scriptValidator.Validate(change.GeneratedContent);
            if (!scriptResult.IsValid)
            {
                result.IsValid = false;
                result.Errors.AddRange(scriptResult.Errors.Select(e => $"[ScriptValidator] {e}"));
            }
        }

        // 2. Layer-specific requirements
        if (!string.IsNullOrWhiteSpace(change.ComponentType) &&
            LayerRequirements.TryGetValue(change.ComponentType, out var required))
        {
            foreach (var token in required)
            {
                if (!string.IsNullOrWhiteSpace(change.GeneratedContent) &&
                    !change.GeneratedContent.Contains(token, StringComparison.OrdinalIgnoreCase))
                {
                    result.Warnings.Add($"[Architecture] Layer '{change.ComponentType}' typically requires '{token}'.");
                }
            }
        }

        // 3. Forbidden patterns
        foreach (var pattern in ForbiddenPatterns)
        {
            if (!string.IsNullOrWhiteSpace(change.GeneratedContent) &&
                change.GeneratedContent.Contains(pattern, StringComparison.OrdinalIgnoreCase))
            {
                result.IsValid = false;
                result.Errors.Add($"[Architecture] Forbidden pattern detected: '{pattern}'.");
            }
        }

        // 4. Hardcoded URLs (should come from appsettings)
        foreach (var urlPattern in HardcodedUrlPatterns)
        {
            if (!string.IsNullOrWhiteSpace(change.GeneratedContent) &&
                change.GeneratedContent.Contains(urlPattern, StringComparison.Ordinal))
            {
                result.Warnings.Add(
                    $"[Architecture] Hardcoded URL detected in generated content. " +
                    $"URLs must be read from appsettings.json via GetRequiredAppSetting().");
            }
        }

        // 5. Naming convention: PageElements files must end with "Objects"
        if (change.ComponentType == "PageElements" &&
            !string.IsNullOrWhiteSpace(change.ClassName) &&
            !change.ClassName.EndsWith("Objects", StringComparison.OrdinalIgnoreCase))
        {
            result.Warnings.Add($"[Architecture] PageElements class '{change.ClassName}' should end with 'Objects'.");
        }

        // 6. PageActions methods should be async
        if (change.ComponentType == "PageActions" &&
            !string.IsNullOrWhiteSpace(change.GeneratedContent) &&
            change.GeneratedContent.Contains("public") &&
            !change.GeneratedContent.Contains("async"))
        {
            result.Warnings.Add("[Architecture] PageActions methods should be async Task.");
        }

        // 7. Duplicate member check against existing file
        if (change.Action == "EXTEND" &&
            !string.IsNullOrWhiteSpace(change.FilePath) &&
            !string.IsNullOrWhiteSpace(change.MemberName) &&
            File.Exists(change.FilePath))
        {
            string existing = File.ReadAllText(change.FilePath);
            if (existing.Contains(change.MemberName, StringComparison.OrdinalIgnoreCase))
            {
                result.Warnings.Add(
                    $"[Architecture] Member '{change.MemberName}' already exists in {change.FilePath}. " +
                    "Consider REUSE instead of EXTEND.");
            }
        }

        return result;
    }

    public ArchitectureValidationResult ValidatePlan(ImplementationPlan plan, string frameworkRoot)
    {
        var combined = new ArchitectureValidationResult { IsValid = true };

        foreach (var change in plan.Changes)
        {
            var r = Validate(change, frameworkRoot);
            if (!r.IsValid)
            {
                combined.IsValid = false;
                combined.Errors.AddRange(r.Errors);
            }
            combined.Warnings.AddRange(r.Warnings);
        }

        // Detect duplicate CREATE decisions for the same file
        var creates = plan.Changes
            .Where(c => c.Action == "CREATE")
            .GroupBy(c => c.FilePath, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1)
            .Select(g => g.Key);

        foreach (var dup in creates)
        {
            combined.IsValid = false;
            combined.Errors.Add($"[Architecture] Duplicate CREATE for same file: {dup}");
        }

        return combined;
    }
}
