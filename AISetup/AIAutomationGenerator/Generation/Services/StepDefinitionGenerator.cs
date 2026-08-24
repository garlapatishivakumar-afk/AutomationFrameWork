using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using AIAutomationGenerator.Generation.Models;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Generation.Services
{
    /// <summary>
    /// Generates Reqnroll StepDefinitions (C#) for recorded actions.
    /// Uses templates for common patterns, calls PageActions.
    /// </summary>
    public class StepDefinitionGenerator
    {
        private readonly GenerationContext _context;
        private readonly FrameworkConventions _conventions;

        public StepDefinitionGenerator(GenerationContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _conventions = context.Conventions ?? new FrameworkConventions();
        }

        /// <summary>
        /// Generate a StepDefinition class containing binding methods.
        /// </summary>
        public string GenerateStepDefinitionClass(string className, string namespaceName, List<string> stepMethods)
        {
            if (string.IsNullOrEmpty(className) || stepMethods == null || stepMethods.Count == 0)
                throw new ArgumentException("ClassName and stepMethods are required.");

            var sb = new StringBuilder();

            // Usings
            foreach (var usingStatement in _conventions.CommonUsings)
            {
                sb.AppendLine(usingStatement);
            }
            sb.AppendLine("using Reqnroll;");
            sb.AppendLine();

            // Namespace
            sb.AppendLine($"namespace {namespaceName}");
            sb.AppendLine("{");

            // Class
            sb.AppendLine($"{_conventions.IndentationStyle}[Binding]");
            sb.AppendLine($"{_conventions.IndentationStyle}public class {className}");
            sb.AppendLine($"{_conventions.IndentationStyle}{{");

            // Constructor (dependency injection if needed)
            sb.AppendLine($"{_conventions.IndentationStyle}{_conventions.IndentationStyle}public {className}()");
            sb.AppendLine($"{_conventions.IndentationStyle}{_conventions.IndentationStyle}{{");
            sb.AppendLine($"{_conventions.IndentationStyle}{_conventions.IndentationStyle}}}");
            sb.AppendLine();

            // Step methods
            foreach (var stepMethod in stepMethods)
            {
                sb.AppendLine(stepMethod);
                sb.AppendLine();
            }

            // End class
            sb.AppendLine($"{_conventions.IndentationStyle}}}");

            // End namespace
            sb.AppendLine("}");

            return sb.ToString();
        }

        /// <summary>
        /// Generate a single step method (Given/When/Then/And/But).
        /// </summary>
        public string GenerateStepMethod(RecordedActionIntelligence action, string relatedPageAction = null)
        {
            var indent = _conventions.IndentationStyle;
            var sb = new StringBuilder();

            var methodName = GenerateMethodName(action);
            var stepType = InferStepType(action.ActionType);
            var stepText = GenerateStepText(action);

            // Binding attribute
            sb.AppendLine($"{indent}{indent}[{stepType}(\"{stepText}\")]");

            // Method signature
            var returnType = _conventions.UseAsync ? "async Task" : "void";
            sb.Append($"{indent}{indent}public {returnType} {methodName}()");
            sb.AppendLine();
            sb.AppendLine($"{indent}{indent}{{");

            // Method body (simple template)
            sb.Append(GenerateMethodBody(action, relatedPageAction, indent));

            sb.AppendLine($"{indent}{indent}}}");

            return sb.ToString();
        }

        private string GenerateMethodName(RecordedActionIntelligence action)
        {
            var verb = action.ActionType switch
            {
                "click" => "Click",
                "fill" => "Fill",
                "select" => "Select",
                "check" => "Check",
                "navigate" => "Navigate",
                _ => "Perform"
            };

            var target = SanitizeTarget(action.Target);
            var camelCase = char.ToLower(target[0]) + target.Substring(1);
            return $"{verb}{target}";
        }

        private string InferStepType(string actionType)
        {
            // First action is usually Given, then When, repeat patterns as And
            // Simplified: click/fill/select are When, navigation could be Given
            return actionType == "navigate" ? "Given" : "When";
        }

        private string GenerateStepText(RecordedActionIntelligence action)
        {
            var target = SanitizeTarget(action.Target);

            return action.ActionType switch
            {
                "click" => $"the user clicks on the {target}",
                "fill" => $"the user fills in {target} with data",
                "select" => $"the user selects an option from {target}",
                "check" => $"the user checks the {target} checkbox",
                "navigate" => $"the user navigates to the {target} page",
                _ => $"the user performs a {action.ActionType} action"
            };
        }

        private string GenerateMethodBody(RecordedActionIntelligence action, string relatedPageAction, string indent)
        {
            var sb = new StringBuilder();

            if (!string.IsNullOrEmpty(relatedPageAction))
            {
                // Call existing PageAction
                var methodCall = $"{relatedPageAction}()";
                if (_conventions.UseAsync)
                    sb.AppendLine($"{indent}{indent}{indent}await {methodCall};");
                else
                    sb.AppendLine($"{indent}{indent}{indent}{methodCall};");
            }
            else
            {
                // Template for generic action
                sb.AppendLine($"{indent}{indent}{indent}// TODO: Implement {action.ActionType} on {SanitizeTarget(action.Target)}");

                if (_conventions.UseAsync)
                    sb.AppendLine($"{indent}{indent}{indent}// await page.{GenerateLocatorCall(action)}.ClickAsync();");
                else
                    sb.AppendLine($"{indent}{indent}{indent}// page.{GenerateLocatorCall(action)}.Click();");
            }

            return sb.ToString();
        }

        private string GenerateLocatorCall(RecordedActionIntelligence action)
        {
            if (action.ActionType == "navigate")
                return $"GotoAsync(\"{action.Target}\")";

            var locatorType = action.LocatorType ?? "css";
            var locatorValue = action.LocatorValue ?? $"[data-testid='{SanitizeTarget(action.Target)}']";

            return locatorType.ToLower() switch
            {
                "role" => $"GetByRole(\"{action.GetByRoleName}\")",
                "id" => $"Locator(\"#{locatorValue}\")",
                "css" => $"Locator(\"{locatorValue}\")",
                "text" => $"GetByText(\"{locatorValue}\")",
                _ => $"Locator(\"{locatorValue}\")"
            } + $".{ConvertActionToMethod(action.ActionType)}";
        }

        private string ConvertActionToMethod(string actionType)
        {
            return actionType switch
            {
                "click" => "ClickAsync()",
                "fill" => "FillAsync(value)",
                "select" => "SelectOptionAsync(value)",
                "check" => "CheckAsync()",
                _ => "ClickAsync()"
            };
        }

        private string SanitizeTarget(string target)
        {
            if (string.IsNullOrEmpty(target))
                return "element";

            return target
                .ToLower()
                .Replace(" ", "_")
                .Trim('"', '\'', '#', '.');
        }
    }
}
