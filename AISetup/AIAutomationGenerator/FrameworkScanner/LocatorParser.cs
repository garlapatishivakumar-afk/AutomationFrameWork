using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Optimization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace AIAutomationGenerator.FrameworkScanner;

public class LocatorParser : ILocatorParser
{
    private static readonly IFileContentCacheService FileCache = new FileContentCacheService();

    // Return-type tokens that indicate an ILocator-returning member
    private static readonly HashSet<string> LocatorReturnTypes =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "ILocator", "Task<ILocator>", "ValueTask<ILocator>"
        };

    public IEnumerable<LocatorModel> Parse(string filePath)
    {
        List<LocatorModel> locators = new();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        UsageTelemetryService.Current?.IncrementParserInvocations();
        string source = FileCache.ReadAllText(filePath);

        SyntaxTree tree = CSharpSyntaxTree.ParseText(source);

        CompilationUnitSyntax root = tree.GetCompilationUnitRoot();

        string pageName = Path.GetFileNameWithoutExtension(filePath);

        // ── (1) ILocator properties (original behaviour) ─────────────────────
        foreach (var property in root.DescendantNodes().OfType<PropertyDeclarationSyntax>())
        {
            if (!IsLocatorType(property.Type.ToString()))
                continue;

            string key = pageName + "." + property.Identifier.Text;
            if (!seen.Add(key)) continue;

            locators.Add(new LocatorModel
            {
                Name        = property.Identifier.Text,
                PageName    = pageName,
                FilePath    = filePath,
                LocatorType = property.Type.ToString(),
                Selector    = property.ExpressionBody?.Expression.ToString() ?? string.Empty
            });
        }

        // ── (2) ILocator-returning methods — V3.2 ────────────────────────────
        // Handles the real framework pattern:
        //   public ILocator SearchQueueButton(IPage page) => page.GetByRole(...);
        foreach (var method in root.DescendantNodes().OfType<MethodDeclarationSyntax>())
        {
            if (!IsLocatorType(method.ReturnType.ToString()))
                continue;

            string key = pageName + "." + method.Identifier.Text;
            if (!seen.Add(key)) continue;

            // Extract the selector/expression from the arrow body or return statement
            string selector = ExtractSelectorExpression(method);

            locators.Add(new LocatorModel
            {
                Name        = method.Identifier.Text,
                PageName    = pageName,
                FilePath    = filePath,
                LocatorType = InferLocatorType(selector),
                Selector    = selector
            });
        }

        return locators;
    }

    // ──────────────────────────────────────────────────────────────────────────

    private static bool IsLocatorType(string typeName) =>
        LocatorReturnTypes.Contains(typeName.Trim());

    /// <summary>
    /// Extracts the locator expression string from an arrow-expression body or
    /// the first return statement inside a block body.
    /// </summary>
    private static string ExtractSelectorExpression(MethodDeclarationSyntax method)
    {
        // Arrow body: public ILocator Foo(IPage p) => p.Locator("#id");
        if (method.ExpressionBody != null)
            return method.ExpressionBody.Expression.ToString();

        // Block body: { return page.Locator("#id"); }
        var ret = method.Body?.DescendantNodes()
            .OfType<ReturnStatementSyntax>()
            .FirstOrDefault();

        return ret?.Expression?.ToString() ?? string.Empty;
    }

    /// <summary>
    /// Infers a concise locator type token from the selector expression string.
    /// This is informational — it does not affect matching logic.
    /// </summary>
    private static string InferLocatorType(string expression)
    {
        if (string.IsNullOrWhiteSpace(expression))        return string.Empty;
        if (expression.Contains("GetByRole(",   StringComparison.OrdinalIgnoreCase) ||
            expression.Contains("getByRole(",   StringComparison.OrdinalIgnoreCase)) return "Role";
        if (expression.Contains("GetByText(",   StringComparison.OrdinalIgnoreCase) ||
            expression.Contains("getByText(",   StringComparison.OrdinalIgnoreCase)) return "Text";
        if (expression.Contains("GetByLabel(",  StringComparison.OrdinalIgnoreCase) ||
            expression.Contains("getByLabel(",  StringComparison.OrdinalIgnoreCase)) return "Label";
        if (expression.Contains("GetByPlaceholder(", StringComparison.OrdinalIgnoreCase) ||
            expression.Contains("getByPlaceholder(", StringComparison.OrdinalIgnoreCase)) return "Placeholder";
        if (expression.Contains("Locator(",     StringComparison.OrdinalIgnoreCase) ||
            expression.Contains("locator(",     StringComparison.OrdinalIgnoreCase)) return "Css";
        return "Unknown";
    }
}