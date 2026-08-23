using System;
using System.Collections.Generic;
using System.Linq;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Intelligence.Services
{
    /// <summary>
    /// Builds intelligence from a Codegen recording by matching against repository knowledge.
    /// Extracts locator types, infers page context, detects business flows.
    /// Minimal token usage — only metadata operations.
    /// </summary>
    public class RecordingIntelligenceBuilder
    {
        private readonly RepositoryKnowledgeModel _repositoryKnowledge;
        private readonly List<RecordedActionIntelligence> _recordingActions;

        public RecordingIntelligenceBuilder(RepositoryKnowledgeModel repositoryKnowledge)
        {
            _repositoryKnowledge = repositoryKnowledge ?? throw new ArgumentNullException(nameof(repositoryKnowledge));
            _recordingActions = new List<RecordedActionIntelligence>();
        }

        /// <summary>
        /// Add an action from Codegen recording.
        /// </summary>
        public void AddAction(RecordedActionIntelligence action)
        {
            if (action != null)
            {
                action.Sequence = _recordingActions.Count;
                _recordingActions.Add(action);
            }
        }

        /// <summary>
        /// Enrich recording with repository intelligence.
        /// Matches actions against existing framework components.
        /// </summary>
        public RecordingIntelligenceModel BuildIntelligence()
        {
            var intelligence = new RecordingIntelligenceModel
            {
                Actions = _recordingActions
            };

            // Enrich each action with repository knowledge
            foreach (var action in _recordingActions)
            {
                EnrichAction(action);
            }

            // Detect business flows
            intelligence.DetectedBusinessFlows = DetectBusinessFlows();

            // Infer probable page
            intelligence.ProbablePage = InferProbablePage();

            // Find related pages
            intelligence.RelatedPages = FindRelatedPages();

            // Calculate overall confidence
            intelligence.ConfidenceScore = CalculateOverallConfidence();

            return intelligence;
        }

        // ===== PRIVATE HELPERS =====

        private void EnrichAction(RecordedActionIntelligence action)
        {
            // Try matching locator to existing PageElement
            if (!string.IsNullOrEmpty(action.LocatorValue))
            {
                var matchedLocator = FindMatchingLocator(action.LocatorValue, action.GetByRoleName);
                if (matchedLocator != null)
                {
                    action.RelatedPageElement = $"{matchedLocator.ClassName}.{matchedLocator.Name}";
                    action.InferredPageContext = matchedLocator.PageOwnership;
                }
            }

            // Try matching to existing PageAction
            if (!string.IsNullOrEmpty(action.Target))
            {
                var matchedAction = FindMatchingPageAction(action.Target, action.ActionType);
                if (matchedAction != null)
                {
                    action.RelatedPageAction = $"{matchedAction.ClassName}.{matchedAction.Name}";
                    if (string.IsNullOrEmpty(action.InferredPageContext))
                        action.InferredPageContext = matchedAction.PageOwnership;
                }
            }

            // Try matching to existing StepDefinition
            if (!string.IsNullOrEmpty(action.Target))
            {
                var matchedStep = FindMatchingStep(action.Target, action.ActionType);
                if (matchedStep != null)
                {
                    action.RelatedStep = $"{matchedStep.MethodName}";
                    if (string.IsNullOrEmpty(action.InferredPageContext))
                        action.InferredPageContext = matchedStep.PageOwnership;
                }
            }
        }

        private PageElementInfo FindMatchingLocator(string locatorValue, string getByRoleName)
        {
            if (string.IsNullOrEmpty(getByRoleName))
            {
                // Match CSS/ID/text-based selectors
                return _repositoryKnowledge.PageElements
                    .Where(l => !string.IsNullOrEmpty(l.Selector))
                    .OrderByDescending(l => SimilarityScore(l.Selector, locatorValue))
                    .FirstOrDefault(l => SimilarityScore(l.Selector, locatorValue) > 0.7);
            }
            else
            {
                // Match getByRole("button", { name: "Search Queue" })
                return _repositoryKnowledge.PageElements
                    .Where(l => l.LocatorType == "Role")
                    .OrderByDescending(l => SimilarityScore(l.Selector, getByRoleName))
                    .FirstOrDefault(l => SimilarityScore(l.Selector, getByRoleName) > 0.7);
            }
        }

        private PageActionInfo FindMatchingPageAction(string target, string actionType)
        {
            // Normalize target: "Search Queue" → "SearchQueue" → "SearchQueueButton" or "ClickSearchQueueButtonAsync"
            var normalized = NormalizeTarget(target);

            return _repositoryKnowledge.PageActions
                .OrderByDescending(a => SimilarityScore(a.Name, normalized))
                .FirstOrDefault(a => SimilarityScore(a.Name, normalized) > 0.65);
        }

        private StepDefinitionInfo FindMatchingStep(string target, string actionType)
        {
            // Convert action to human-like step text
            var stepLike = BuildStepText(target, actionType);

            return _repositoryKnowledge.StepDefinitions
                .OrderByDescending(s => SimilarityScore(s.StepText, stepLike))
                .FirstOrDefault(s => SimilarityScore(s.StepText, stepLike) > 0.65);
        }

        private List<string> DetectBusinessFlows()
        {
            // Simple heuristic: group actions by page context
            var flowsByPage = new Dictionary<string, List<RecordedActionIntelligence>>();

            foreach (var action in _recordingActions)
            {
                var page = action.InferredPageContext ?? "Unknown";
                if (!flowsByPage.ContainsKey(page))
                    flowsByPage[page] = new List<RecordedActionIntelligence>();

                flowsByPage[page].Add(action);
            }

            // Generate flow names from page sequences
            var flows = new List<string>();
            foreach (var entry in flowsByPage.OrderBy(e => e.Value.First().Sequence))
            {
                if (entry.Key != "Unknown")
                    flows.Add(entry.Key);
            }

            return flows.Count > 0 ? flows : new List<string> { "Undetected Business Flow" };
        }

        private string InferProbablePage()
        {
            // Page with most matched actions
            var pageCounts = new Dictionary<string, int>();

            foreach (var action in _recordingActions)
            {
                if (!string.IsNullOrEmpty(action.InferredPageContext))
                {
                    if (!pageCounts.ContainsKey(action.InferredPageContext))
                        pageCounts[action.InferredPageContext] = 0;
                    pageCounts[action.InferredPageContext]++;
                }
            }

            return pageCounts.Count > 0
                ? pageCounts.OrderByDescending(p => p.Value).First().Key
                : "Unknown";
        }

        private List<string> FindRelatedPages()
        {
            var pages = _recordingActions
                .Where(a => !string.IsNullOrEmpty(a.InferredPageContext))
                .Select(a => a.InferredPageContext)
                .Distinct()
                .ToList();

            return pages;
        }

        private double CalculateOverallConfidence()
        {
            if (_recordingActions.Count == 0)
                return 0.0;

            var matchedCount = _recordingActions.Count(a =>
                !string.IsNullOrEmpty(a.RelatedPageElement) ||
                !string.IsNullOrEmpty(a.RelatedPageAction) ||
                !string.IsNullOrEmpty(a.RelatedStep));

            return (double)matchedCount / _recordingActions.Count;
        }

        private double SimilarityScore(string a, string b)
        {
            if (string.IsNullOrEmpty(a) || string.IsNullOrEmpty(b))
                return 0.0;

            var normalized_a = Normalize(a);
            var normalized_b = Normalize(b);

            if (normalized_a == normalized_b)
                return 1.0;

            if (normalized_a.Contains(normalized_b) || normalized_b.Contains(normalized_a))
                return 0.9;

            // Simple Levenshtein-inspired scoring
            var matches = 0;
            for (int i = 0; i < Math.Min(normalized_a.Length, normalized_b.Length); i++)
            {
                if (normalized_a[i] == normalized_b[i])
                    matches++;
            }

            return (double)matches / Math.Max(normalized_a.Length, normalized_b.Length);
        }

        private string Normalize(string text)
        {
            if (string.IsNullOrEmpty(text))
                return "";

            // Remove spaces, convert to lowercase, keep alphanumeric
            return System.Text.RegularExpressions.Regex.Replace(text, @"[^a-z0-9]", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).ToLower();
        }

        private string NormalizeTarget(string target)
        {
            // "Search Queue" → "SearchQueue"
            return System.Text.RegularExpressions.Regex.Replace(target, @"\s+", "");
        }

        private string BuildStepText(string target, string actionType)
        {
            // Convert action to step-like text
            return actionType switch
            {
                "click" => $"user clicks {target}",
                "fill" => $"user fills {target}",
                "select" => $"user selects {target}",
                "check" => $"user checks {target}",
                "navigate" => $"user navigates to {target}",
                _ => $"user performs {actionType} on {target}"
            };
        }
    }
}
