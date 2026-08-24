using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using AIAutomationGenerator.Generation.Models;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Generation.Services
{
    /// <summary>
    /// Generates PageElement classes with ILocator methods.
    /// Uses template-based generation for common locator patterns.
    /// </summary>
    public class PageElementGenerator
    {
        private readonly GenerationContext _context;
        private readonly FrameworkConventions _conventions;

        public PageElementGenerator(GenerationContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _conventions = context.Conventions ?? new FrameworkConventions();
        }

        /// <summary>
        /// Generate a PageElements class with ILocator properties/methods.
        /// </summary>
        public string GeneratePageElementsClass(string className, string namespaceName, List<string> locatorMethods)
        {
            if (string.IsNullOrEmpty(className) || locatorMethods == null || locatorMethods.Count == 0)
                throw new ArgumentException("ClassName and locatorMethods are required.");

            var sb = new StringBuilder();

            // Usings
            sb.AppendLine("using System;");
            sb.AppendLine("using Microsoft.Playwright;");
            sb.AppendLine();

            // Namespace
            sb.AppendLine($"namespace {namespaceName}");
            sb.AppendLine("{");

            // Class
            if (_conventions.GenerateXmlDocs)
            {
                sb.AppendLine($"{_conventions.IndentationStyle}/// <summary>");
                sb.AppendLine($"{_conventions.IndentationStyle}/// Page Object Model for {ExtractPageName(className)}.s");
                sb.AppendLine($"{_conventions.IndentationStyle}/// </summary>");
            }

            sb.AppendLine($"{_conventions.IndentationStyle}public class {className}");
            sb.AppendLine($"{_conventions.IndentationStyle}{{");

            // Page field
            sb.AppendLine($"{_conventions.IndentationStyle}{_conventions.IndentationStyle}private readonly IPage _page;");
            sb.AppendLine();

            // Constructor
            sb.AppendLine($"{_conventions.IndentationStyle}{_conventions.IndentationStyle}public {className}(IPage page)");
            sb.AppendLine($"{_conventions.IndentationStyle}{_conventions.IndentationStyle}{{");
            sb.AppendLine($"{_conventions.IndentationStyle}{_conventions.IndentationStyle}{_conventions.IndentationStyle}_page = page ?? throw new ArgumentNullException(nameof(page));");
            sb.AppendLine($"{_conventions.IndentationStyle}{_conventions.IndentationStyle}}}");
            sb.AppendLine();

            // Locator methods
            foreach (var locatorMethod in locatorMethods)
            {
                sb.AppendLine(locatorMethod);
                sb.AppendLine();
            }

            // End class
            sb.AppendLine($"{_conventions.IndentationStyle}}}");

            // End namespace
            sb.AppendLine("}");

            return sb.ToString();
        }

        /// <summary>
        /// Generate a single ILocator method.
        /// </summary>
        public string GenerateLocatorMethod(RecordedActionIntelligence action)
        {
            var indent = _conventions.IndentationStyle;
            var sb = new StringBuilder();

            var methodName = GenerateMethodName(action);
            var locatorExpression = GenerateLocatorExpression(action);

            // XML doc
            if (_conventions.GenerateXmlDocs)
            {
                sb.AppendLine($"{indent}{indent}/// <summary>");
                sb.AppendLine($"{indent}{indent}/// Gets the locator for {SanitizeTarget(action.Target)}.s");
                sb.AppendLine($"{indent}{indent}/// </summary>");
                sb.AppendLine($"{indent}{indent}/// <returns>ILocator pointing to the element.</returns>");
            }

            // Method signature
            sb.Append($"{indent}{indent}public ILocator {methodName}()");
            sb.AppendLine($" => {locatorExpression}");

            return sb.ToString();
        }

        private string GenerateMethodName(RecordedActionIntelligence action)
        {
            var target = SanitizeTarget(action.Target);
            // SearchQueueButton
            return char.ToUpper(target[0]) + target.Substring(1);
        }

        private string GenerateLocatorExpression(RecordedActionIntelligence action)
        {
            var locatorType = action.LocatorType ?? "css";

            return locatorType.ToLower() switch
            {
                "role" => GenerateGetByRoleExpression(action),
                "id" => GenerateIdExpression(action),
                "css" => GenerateCssExpression(action),
                "text" => GenerateGetByTextExpression(action),
                _ => GenerateCssExpression(action)
            };
        }

        private string GenerateGetByRoleExpression(RecordedActionIntelligence action)
        {
            var role = action.GetByRoleName ?? "button";
            var target = SanitizeTarget(action.Target);

            return $"_page.GetByRole(AriaRole.{CapitalizeRole(role)}, new() {{ NameString = \"{target}\" }})";
        }

        private string GenerateIdExpression(RecordedActionIntelligence action)
        {
            var id = action.LocatorValue ?? SanitizeTarget(action.Target);
            return $"_page.Locator(\"#{id}\")";
        }

        private string GenerateCssExpression(RecordedActionIntelligence action)
        {
            var selector = action.LocatorValue ?? $"[data-testid='{SanitizeTarget(action.Target)}']";
            return $"_page.Locator(\"{selector}\")";
        }

        private string GenerateGetByTextExpression(RecordedActionIntelligence action)
        {
            var text = action.Target ?? "element";
            return $"_page.GetByText(\"{text}\")";
        }

        private string SanitizeTarget(string target)
        {
            if (string.IsNullOrEmpty(target))
                return "element";

            return target
                .Trim()
                .Replace(" ", "_")
                .Replace("-", "_")
                .Trim('"', '\'', '#', '.');
        }

        private string CapitalizeRole(string role)
        {
            return char.ToUpper(role[0]) + role.Substring(1).ToLower();
        }

        private string ExtractPageName(string className)
        {
            // ViewDashboardObjects → ViewDashboard
            var suffixes = new[] { "Objects", "Locators", "Elements" };
            foreach (var suffix in suffixes)
            {
                if (className.EndsWith(suffix))
                    return className.Substring(0, className.Length - suffix.Length);
            }

            return className;
        }
    }
}
