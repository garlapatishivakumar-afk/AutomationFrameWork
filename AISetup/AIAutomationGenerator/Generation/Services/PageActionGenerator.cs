using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using AIAutomationGenerator.Generation.Models;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Generation.Services
{
    /// <summary>
    /// Generates PageAction methods that use PageElements.
    /// Creates async methods that encapsulate UI interactions.
    /// </summary>
    public class PageActionGenerator
    {
        private readonly GenerationContext _context;
        private readonly FrameworkConventions _conventions;

        public PageActionGenerator(GenerationContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _conventions = context.Conventions ?? new FrameworkConventions();
        }

        /// <summary>
        /// Generate a PageActions class with async methods.
        /// </summary>
        public string GeneratePageActionsClass(string className, string namespaceName, List<string> actionMethods)
        {
            if (string.IsNullOrEmpty(className) || actionMethods == null || actionMethods.Count == 0)
                throw new ArgumentException("ClassName and actionMethods are required.");

            var sb = new StringBuilder();

            // Usings
            sb.AppendLine("using System;");
            sb.AppendLine("using System.Threading.Tasks;");
            sb.AppendLine("using Microsoft.Playwright;");
            sb.AppendLine();

            // Namespace
            sb.AppendLine($"namespace {namespaceName}");
            sb.AppendLine("{");

            // Class
            if (_conventions.GenerateXmlDocs)
            {
                sb.AppendLine($"{_conventions.IndentationStyle}/// <summary>");
                sb.AppendLine($"{_conventions.IndentationStyle}/// Page Actions for {ExtractPageName(className)}.s");
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

            // Action methods
            foreach (var actionMethod in actionMethods)
            {
                sb.AppendLine(actionMethod);
                sb.AppendLine();
            }

            // End class
            sb.AppendLine($"{_conventions.IndentationStyle}}}");

            // End namespace
            sb.AppendLine("}");

            return sb.ToString();
        }

        /// <summary>
        /// Generate a single PageAction method.
        /// </summary>
        public string GeneratePageActionMethod(RecordedActionIntelligence action, string relatedPageElement = null)
        {
            var indent = _conventions.IndentationStyle;
            var sb = new StringBuilder();

            var methodName = GenerateMethodName(action);
            var target = SanitizeTarget(action.Target);

            // XML doc
            if (_conventions.GenerateXmlDocs)
            {
                sb.AppendLine($"{indent}{indent}/// <summary>");
                sb.AppendLine($"{indent}{indent}/// Performs {action.ActionType} action on {target}.s");
                sb.AppendLine($"{indent}{indent}/// </summary>");
                sb.AppendLine($"{indent}{indent}/// <returns>A task representing the async operation.</returns>");
            }

            // Method signature
            sb.AppendLine($"{indent}{indent}public async Task {methodName}()");
            sb.AppendLine($"{indent}{indent}{{");

            // Method body
            sb.Append(GenerateMethodBody(action, relatedPageElement, indent));

            sb.AppendLine($"{indent}{indent}}}");

            return sb.ToString();
        }

        private string GenerateMethodName(RecordedActionIntelligence action)
        {
            var verb = GetActionVerb(action.ActionType);
            var target = SanitizeTarget(action.Target);

            // ClickSearchQueueButtonAsync
            return $"{verb}{target}Async";
        }

        private string GetActionVerb(string actionType)
        {
            return actionType switch
            {
                "click" => "Click",
                "fill" => "Fill",
                "select" => "Select",
                "check" => "Check",
                "navigate" => "Navigate",
                _ => "Execute"
            };
        }

        private string GenerateMethodBody(RecordedActionIntelligence action, string relatedPageElement, string indent)
        {
            var sb = new StringBuilder();
            var target = SanitizeTarget(action.Target);

            if (!string.IsNullOrEmpty(relatedPageElement))
            {
                // Use existing PageElement
                var locatorCall = $"{relatedPageElement}";

                var actionMethod = action.ActionType switch
                {
                    "click" => $"await {locatorCall}.ClickAsync();",
                    "fill" => $"await {locatorCall}.FillAsync(\"value\"); // TODO: Pass actual value",
                    "select" => $"await {locatorCall}.SelectOptionAsync(\"option\"); // TODO: Pass actual option",
                    "check" => $"await {locatorCall}.CheckAsync();",
                    "navigate" => $"await _page.GotoAsync(\"{action.Target}\");",
                    _ => $"// TODO: Implement {action.ActionType} action"
                };

                sb.AppendLine($"{indent}{indent}{indent}{actionMethod}");
            }
            else
            {
                // Template without PageElement
                sb.AppendLine($"{indent}{indent}{indent}// TODO: Implement {action.ActionType} action on {target}");

                var template = action.ActionType switch
                {
                    "click" => $"// await _page.Locator(\"selector\").ClickAsync();",
                    "fill" => $"// await _page.Locator(\"selector\").FillAsync(\"value\");",
                    "select" => $"// await _page.Locator(\"selector\").SelectOptionAsync(\"option\");",
                    "check" => $"// await _page.Locator(\"selector\").CheckAsync();",
                    "navigate" => $"// await _page.GotoAsync(\"{action.Target}\");",
                    _ => "// TODO"
                };

                sb.AppendLine($"{indent}{indent}{indent}{template}");
            }

            return sb.ToString();
        }

        private string SanitizeTarget(string target)
        {
            if (string.IsNullOrEmpty(target))
                return "element";

            return target
                .ToLower()
                .Split(' ')
                .Aggregate("", (acc, word) => acc + char.ToUpper(word[0]) + word.Substring(1))
                .Trim('"', '\'', '#', '.');
        }

        private string ExtractPageName(string className)
        {
            // ViewDashboardMethods → ViewDashboard
            var suffixes = new[] { "Methods", "Actions", "Commands" };
            foreach (var suffix in suffixes)
            {
                if (className.EndsWith(suffix))
                    return className.Substring(0, className.Length - suffix.Length);
            }

            return className;
        }
    }
}
