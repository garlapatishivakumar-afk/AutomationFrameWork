using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class ScriptValidator : IScriptValidator
{
    public ValidationResult Validate(string content)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(content))
        {
            errors.Add("Script content is empty.");
            return new ValidationResult { IsValid = false, Errors = errors };
        }

        if (!content.Contains("namespace", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("Missing namespace.");
        }

        if (!content.Contains("using", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("Missing using statements.");
        }

        if (!content.Contains("class", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("Invalid class names.");
        }
        if (content.Contains("Scenario", StringComparison.OrdinalIgnoreCase) &&
            !content.Contains("Feature", StringComparison.OrdinalIgnoreCase))
        {
            errors.Add("Missing Feature declaration.");
        }
        var classMatches = System.Text.RegularExpressions.Regex.Matches(
            content,
            @"class\s+([A-Za-z0-9_]+)");

        var duplicateClasses =
            classMatches
                .Select(x => x.Groups[1].Value)
                .GroupBy(x => x)
                .Where(x => x.Count() > 1);

        foreach (var duplicate in duplicateClasses)
        {
            errors.Add($"Duplicate class: {duplicate.Key}");
        }
        var methodMatches =
            System.Text.RegularExpressions.Regex.Matches(
                content,
                @"void\s+([A-Za-z0-9_]+)\s*\(");

        var duplicateMethods =
            methodMatches
                .Select(x => x.Groups[1].Value)
                .GroupBy(x => x)
                .Where(x => x.Count() > 1);

        foreach (var duplicate in duplicateMethods)
        {
            errors.Add($"Duplicate method: {duplicate.Key}");
        }
        // var emptyMethods =
        //     System.Text.RegularExpressions.Regex.Matches(
        //         content,
        //         @"void\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{\s*\}");

        // foreach (System.Text.RegularExpressions.Match match in emptyMethods)
        // {
        //     errors.Add($"Method {match.Groups[1].Value} is empty.");
        // }
        var stepMatches =
        System.Text.RegularExpressions.Regex.Matches(
        content,
        @"\[(Given|When|Then).*?\(""([^""]+)""\)\]");

        var duplicateSteps =
            stepMatches
                .Select(x => x.Groups[2].Value)
                .GroupBy(x => x)
                .Where(x => x.Count() > 1);

        foreach (var duplicate in duplicateSteps)
        {
            errors.Add($"Duplicate step definition: {duplicate.Key}");
        }

        return new ValidationResult { IsValid = errors.Count == 0, Errors = errors };
    }

    public string AutoFix(string content)
{
    if (string.IsNullOrWhiteSpace(content))
        return content;

    content = content.Replace("\t", "    ");

    while (content.Contains("  "))
    {
        content = content.Replace("  ", " ");
    }

    return content;
}
}
