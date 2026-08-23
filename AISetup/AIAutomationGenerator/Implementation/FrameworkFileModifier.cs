using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Implementation;

/// <summary>
/// V3.0 — Safely modifies or creates Automation Framework files.
/// NEVER replaces an entire existing file when a targeted modification is sufficient.
/// Writes to a temp file first; validates; only overwrites on pass.
/// </summary>
public class FrameworkFileModifier : IFrameworkFileModifier
{
    private readonly IArchitectureValidator validator;
    private readonly ILogger logger;

    public FrameworkFileModifier(IArchitectureValidator validator, ILogger logger)
    {
        this.validator = validator;
        this.logger    = logger;
    }

    public async Task<bool> ApplyAsync(ImplementationChange change, string frameworkRoot)
    {
        if (change.Action == "REUSE")
        {
            logger.LogInformation($"[FrameworkFileModifier] REUSE — no file change: {change.ClassName}.{change.MemberName}");
            return true;
        }

        // Pre-validate architecture
        if (change.ValidationRequired)
        {
            var validation = validator.Validate(change, frameworkRoot);
            if (!validation.IsValid)
            {
                foreach (var err in validation.Errors)
                    logger.LogInformation($"[FrameworkFileModifier] Validation error: {err}");
                return false;
            }
        }

        switch (change.Action)
        {
            case "CREATE":
                return await CreateFileAsync(change);

            case "EXTEND":
            case "MODIFY":
                return await ExtendFileAsync(change);

            default:
                logger.LogInformation($"[FrameworkFileModifier] Unknown action: {change.Action}");
                return false;
        }
    }

    public async Task<FrameworkModificationResult> ApplyPlanAsync(ImplementationPlan plan, string frameworkRoot)
    {
        var result = new FrameworkModificationResult();

        // Validate entire plan first
        var planValidation = validator.ValidatePlan(plan, frameworkRoot);
        if (!planValidation.IsValid)
        {
            result.Success = false;
            result.Errors.AddRange(planValidation.Errors);
            return result;
        }

        foreach (var change in plan.Changes)
        {
            bool success = await ApplyAsync(change, frameworkRoot);
            if (success)
            {
                if (change.Action != "REUSE" && !string.IsNullOrWhiteSpace(change.FilePath))
                    result.AppliedFiles.Add(change.FilePath);
            }
            else
            {
                result.Errors.Add($"Failed to apply {change.Action} on {change.FilePath}");
                result.SkippedFiles.Add(change.FilePath);

                // Abort on first failure to avoid partial-state corruption
                result.Success = false;
                return result;
            }
        }

        result.Success = true;
        return result;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private file operations
    // ──────────────────────────────────────────────────────────────────────────

    private async Task<bool> CreateFileAsync(ImplementationChange change)
    {
        if (string.IsNullOrWhiteSpace(change.FilePath))
        {
            logger.LogInformation("[FrameworkFileModifier] CREATE: no file path specified.");
            return false;
        }

        if (File.Exists(change.FilePath))
        {
            logger.LogInformation($"[FrameworkFileModifier] CREATE skipped — file already exists: {change.FilePath}");
            return false; // Duplicate prevention
        }

        if (string.IsNullOrWhiteSpace(change.GeneratedContent))
        {
            logger.LogInformation($"[FrameworkFileModifier] CREATE: no content for {change.FilePath}");
            return false;
        }

        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(change.FilePath)!);
            string tempPath = change.FilePath + ".v3.tmp";
            await File.WriteAllTextAsync(tempPath, change.GeneratedContent);

            // Move temp to final only after successful write
            File.Move(tempPath, change.FilePath, overwrite: false);
            logger.LogInformation($"[FrameworkFileModifier] Created: {change.FilePath}");
            return true;
        }
        catch (Exception ex)
        {
            logger.LogInformation($"[FrameworkFileModifier] CREATE failed: {ex.Message}");
            return false;
        }
    }

    private async Task<bool> ExtendFileAsync(ImplementationChange change)
    {
        if (string.IsNullOrWhiteSpace(change.FilePath) || !File.Exists(change.FilePath))
        {
            logger.LogInformation($"[FrameworkFileModifier] EXTEND: target file not found: {change.FilePath}");
            return false;
        }

        if (string.IsNullOrWhiteSpace(change.GeneratedContent))
        {
            logger.LogInformation($"[FrameworkFileModifier] EXTEND: no content for {change.FilePath}");
            return false;
        }

        try
        {
            string original = await File.ReadAllTextAsync(change.FilePath);

            // Safety: do not insert if the member already exists
            if (!string.IsNullOrWhiteSpace(change.MemberName) &&
                original.Contains(change.MemberName, StringComparison.OrdinalIgnoreCase))
            {
                logger.LogInformation($"[FrameworkFileModifier] EXTEND skipped — '{change.MemberName}' already exists in {change.FilePath}");
                return true; // Idempotent — treat as success
            }

            // Insert before the last closing brace of the class
            string extended = InsertBeforeLastBrace(original, change.GeneratedContent);

            string tempPath = change.FilePath + ".v3.tmp";
            await File.WriteAllTextAsync(tempPath, extended);
            File.Move(tempPath, change.FilePath, overwrite: true);

            logger.LogInformation($"[FrameworkFileModifier] Extended: {change.FilePath} ({change.MemberName})");
            return true;
        }
        catch (Exception ex)
        {
            logger.LogInformation($"[FrameworkFileModifier] EXTEND failed: {ex.Message}");
            return false;
        }
    }

    /// <summary>Inserts <paramref name="content"/> before the final closing brace of a class.</summary>
    private static string InsertBeforeLastBrace(string source, string content)
    {
        int lastBrace = source.LastIndexOf('}');
        if (lastBrace < 0)
            return source + "\n" + content;

        return source.Substring(0, lastBrace)
            + "\n"
            + content.TrimEnd()
            + "\n"
            + source.Substring(lastBrace);
    }
}
