using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using AIAutomationGenerator.Generation.Models;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Generation.Services
{
    /// <summary>
    /// Generates BDD Feature files (Gherkin) from recording and business flows.
    /// Uses deterministic generation for structure, business language from detected flows.
    /// </summary>
    public class FeatureFileGenerator
    {
        private readonly GenerationContext _context;
        private readonly FrameworkConventions _conventions;

        public FeatureFileGenerator(GenerationContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _conventions = context.Conventions ?? new FrameworkConventions();
        }

        /// <summary>
        /// Generate Feature file content from recording and detected flows.
        /// </summary>
        public string GenerateFeatureFile()
        {
            var sb = new StringBuilder();

            // Header
            sb.AppendLine($"Feature: {GenerateFeatureName()}");
            sb.AppendLine();

            // Description
            var description = GenerateFeatureDescription();
            if (!string.IsNullOrEmpty(description))
            {
                sb.AppendLine($"  {description}");
                sb.AppendLine();
            }

            // Scenarios
            var scenarios = GenerateScenarios();
            foreach (var scenario in scenarios)
            {
                sb.AppendLine(scenario);
                sb.AppendLine();
            }

            return sb.ToString();
        }

        private string GenerateFeatureName()
        {
            // Use detected business flow or fallback to pages
            if (_context.DetectedFlows?.Any() == true)
            {
                var flow = _context.DetectedFlows.First();
                return flow.FeatureName ?? flow.FlowName;
            }

            // Fallback: use probable page
            if (!string.IsNullOrEmpty(_context.Recording?.ProbablePage))
                return $"{_context.Recording.ProbablePage} Workflow";

            return "Generated Automation Feature";
        }

        private string GenerateFeatureDescription()
        {
            var flows = _context.DetectedFlows;

            if (flows == null || flows.Count == 0)
                return "Automated test scenario generated from Codegen recording.";

            var flowDesc = string.Join(", ", flows.ConvertAll(f => f.FlowName));
            return $"Feature covers the following workflows: {flowDesc}";
        }

        private List<string> GenerateScenarios()
        {
            var scenarios = new List<string>();

            if (_context.Recording?.Actions == null || _context.Recording.Actions.Count == 0)
                return scenarios;

            // Strategy: one scenario per detected business flow
            // If no flows detected, create one comprehensive scenario

            if (_context.DetectedFlows?.Any() == true)
            {
                // One scenario per flow
                foreach (var flow in _context.DetectedFlows)
                {
                    scenarios.Add(GenerateScenarioForFlow(flow));
                }
            }
            else
            {
                // Single comprehensive scenario
                scenarios.Add(GenerateSingleScenario());
            }

            return scenarios;
        }

        private string GenerateScenarioForFlow(BusinessFlowIntelligence flow)
        {
            var sb = new StringBuilder();

            sb.AppendLine($"  Scenario: {SanitizeScenarioName(flow.FlowName)}");

            // Get actions for this flow
            var flowActions = _context.Recording.Actions
                .Where(a => flow.ActionSequences.Contains(a.Sequence))
                .ToList();

            // Generate Given, When, Then
            GenerateGivenWhenThen(sb, flowActions);

            return sb.ToString();
        }

        private string GenerateSingleScenario()
        {
            var sb = new StringBuilder();

            sb.AppendLine($"  Scenario: Execute recorded automation");

            GenerateGivenWhenThen(sb, _context.Recording.Actions);

            return sb.ToString();
        }

        private void GenerateGivenWhenThen(StringBuilder sb, List<RecordedActionIntelligence> actions)
        {
            if (actions == null || actions.Count == 0)
                return;

            // Given: starting context
            sb.AppendLine($"    Given the user is on the application");

            // When: main actions
            var whenActions = actions.Where(a => a.ActionType != "navigate").ToList();
            if (whenActions.Any())
            {
                sb.AppendLine($"    When the user performs the following actions");
                foreach (var action in whenActions)
                {
                    var stepText = ConvertActionToStepText(action);
                    sb.AppendLine($"      And {stepText}");
                }
            }

            // Then: validation (if any assertion-like actions)
            sb.AppendLine($"    Then the action should complete successfully");
        }

        private string ConvertActionToStepText(RecordedActionIntelligence action)
        {
            return action.ActionType switch
            {
                "click" => $"clicks the {SanitizeTarget(action.Target)} button",
                "fill" => $"fills {SanitizeTarget(action.Target)} with appropriate data",
                "select" => $"selects an option from {SanitizeTarget(action.Target)}",
                "check" => $"checks the {SanitizeTarget(action.Target)} checkbox",
                "navigate" => $"navigates to {action.Target}",
                _ => $"performs a {action.ActionType} action on {SanitizeTarget(action.Target)}"
            };
        }

        private string SanitizeTarget(string target)
        {
            if (string.IsNullOrEmpty(target))
                return "the element";

            return target
                .ToLower()
                .Trim('"', '\'')
                .Replace("_", " ");
        }

        private string SanitizeScenarioName(string name)
        {
            if (string.IsNullOrEmpty(name))
                return "Generated Scenario";

            // Replace underscores and arrows with spaces
            return name
                .Replace("_", " ")
                .Replace("→", "to")
                .Trim();
        }
    }
}
