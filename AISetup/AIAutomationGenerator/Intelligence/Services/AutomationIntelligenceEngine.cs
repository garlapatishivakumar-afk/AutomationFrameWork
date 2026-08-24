using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Interfaces;

namespace AIAutomationGenerator.Intelligence.Services
{
    /// <summary>
    /// Main orchestrator for V4.0 Prompt 1 intelligence layer.
    /// Coordinates repository indexing, recording analysis, business flow detection.
    /// Produces unified AutomationIntelligenceModel for V4.0 Prompt 2 (Generation).
    /// </summary>
    public class AutomationIntelligenceEngine
    {
        private readonly FrameworkIndexService _indexService;
        private readonly IArchitectureDecisionEngine _architectureEngine;

        public AutomationIntelligenceEngine(FrameworkIndexService indexService, IArchitectureDecisionEngine architectureEngine)
        {
            _indexService = indexService ?? throw new ArgumentNullException(nameof(indexService));
            _architectureEngine = architectureEngine;
        }

        /// <summary>
        /// Build complete automation intelligence from recording and repository.
        /// V5.0 P1: Applies RelevantContextSelector before enrichment so only
        /// relevant components enter the pipeline. Metrics are recorded in the model.
        /// </summary>
        public async Task<AutomationIntelligenceModel> AnalyzeRecordingAsync(
            string repositoryRoot,
            List<RecordedActionIntelligence> recordingActions,
            bool forceRebuildIndex = false)
        {
            // Phase 1: Load/rebuild full repository index
            var fullIndex = await _indexService.GetIndexAsync(forceRebuildIndex);

            if (fullIndex == null || !fullIndex.PageElements.Any())
            {
                throw new InvalidOperationException("Repository knowledge index is empty. Cannot build intelligence.");
            }

            // Phase 1b (V5.0 P1): Select only relevant context before passing downstream.
            // This replaces passing the full index through every pipeline stage.
            var selector      = new RelevantContextSelector();
            var selectionResult = selector.SelectRelevantContext(fullIndex, recordingActions);
            var repositoryKnowledge = selectionResult.FilteredIndex;

            // Phase 2: Build recording intelligence (enriches actions against filtered index)
            var recordingIntelligence = BuildRecordingIntelligence(repositoryKnowledge, recordingActions);

            // Phase 3: Build business flow analysis
            var businessFlows = BuildBusinessFlowIntelligence(recordingIntelligence);

            // Phase 4: Extract architecture decisions
            var decisions = BuildIntelligenceDecisions(recordingIntelligence, repositoryKnowledge);

            // Phase 5: Assemble unified result — RepositoryKnowledge is now the FILTERED slice
            var intelligence = new AutomationIntelligenceModel
            {
                AnalysisTimestamp   = DateTime.UtcNow.ToString("O"),
                RepositoryRoot      = repositoryRoot,
                RepositoryKnowledge = repositoryKnowledge,   // filtered slice
                ContextSelection    = selectionResult.Metrics, // measurable reduction
                RecordingIntelligence = recordingIntelligence,
                BusinessFlows       = businessFlows,
                Decisions           = decisions
            };

            return intelligence;
        }

        private RecordingIntelligenceModel BuildRecordingIntelligence(
            RepositoryKnowledgeModel repositoryKnowledge,
            List<RecordedActionIntelligence> recordingActions)
        {
            var builder = new RecordingIntelligenceBuilder(repositoryKnowledge);

            foreach (var action in recordingActions)
            {
                builder.AddAction(action);
            }

            return builder.BuildIntelligence();
        }

        private List<BusinessFlowIntelligence> BuildBusinessFlowIntelligence(RecordingIntelligenceModel recording)
        {
            var flows = new List<BusinessFlowIntelligence>();

            if (recording?.Actions == null || recording.Actions.Count == 0)
                return flows;

            // Group actions by page to identify flows
            var pageGroups = new Dictionary<string, List<RecordedActionIntelligence>>();

            foreach (var action in recording.Actions)
            {
                var page = action.InferredPageContext ?? "Unknown";
                if (!pageGroups.ContainsKey(page))
                    pageGroups[page] = new List<RecordedActionIntelligence>();

                pageGroups[page].Add(action);
            }

            // Build flow for each page transition
            var pageSequence = recording.Actions
                .GroupBy(a => a.InferredPageContext)
                .Select(g => g.Key)
                .Distinct()
                .ToList();

            var flowName = string.Join(" → ", pageSequence.Where(p => p != "Unknown"));

            if (string.IsNullOrEmpty(flowName))
                flowName = "General Automation Flow";

            flows.Add(new BusinessFlowIntelligence
            {
                FlowName = flowName,
                InvolvedPages = pageSequence.Where(p => p != "Unknown").ToList(),
                ActionSequences = recording.Actions.Select(a => a.Sequence).ToList(),
                ConfidenceScore = CalculateFlowConfidence(recording),
                FeatureName = GenerateFeatureName(pageSequence)
            });

            return flows;
        }

        private List<IntelligenceDecision> BuildIntelligenceDecisions(
            RecordingIntelligenceModel recording,
            RepositoryKnowledgeModel knowledge)
        {
            var decisions = new List<IntelligenceDecision>();

            if (recording?.Actions == null)
                return decisions;

            for (int i = 0; i < recording.Actions.Count; i++)
            {
                var action = recording.Actions[i];

                // Decision for PageElement
                if (!string.IsNullOrEmpty(action.RelatedPageElement))
                {
                    decisions.Add(new IntelligenceDecision
                    {
                        ActionIndex = i,
                        ActionDescription = $"{action.ActionType} {action.Target}",
                        DecisionType = "PageElement",
                        Recommendation = "REUSE",
                        TargetComponent = action.RelatedPageElement,
                        ConfidenceScore = 0.85,
                        Rationale = $"Existing locator '{action.RelatedPageElement}' matches the target element."
                    });
                }
                else if (!string.IsNullOrEmpty(action.LocatorValue))
                {
                    decisions.Add(new IntelligenceDecision
                    {
                        ActionIndex = i,
                        ActionDescription = $"{action.ActionType} {action.Target}",
                        DecisionType = "PageElement",
                        Recommendation = "CREATE",
                        TargetComponent = $"New locator for {action.Target}",
                        ConfidenceScore = 0.70,
                        Rationale = "No matching existing locator found. New PageElement required."
                    });
                }

                // Decision for PageAction
                if (!string.IsNullOrEmpty(action.RelatedPageAction))
                {
                    decisions.Add(new IntelligenceDecision
                    {
                        ActionIndex = i,
                        ActionDescription = $"{action.ActionType} {action.Target}",
                        DecisionType = "PageAction",
                        Recommendation = "REUSE",
                        TargetComponent = action.RelatedPageAction,
                        ConfidenceScore = 0.85,
                        Rationale = $"Existing method '{action.RelatedPageAction}' implements this action."
                    });
                }
                else
                {
                    decisions.Add(new IntelligenceDecision
                    {
                        ActionIndex = i,
                        ActionDescription = $"{action.ActionType} {action.Target}",
                        DecisionType = "PageAction",
                        Recommendation = "CREATE",
                        TargetComponent = $"New {action.ActionType} method",
                        ConfidenceScore = 0.70,
                        Rationale = "No matching existing PageAction found. New method required."
                    });
                }

                // Decision for StepDefinition
                if (!string.IsNullOrEmpty(action.RelatedStep))
                {
                    decisions.Add(new IntelligenceDecision
                    {
                        ActionIndex = i,
                        ActionDescription = $"{action.ActionType} {action.Target}",
                        DecisionType = "StepDefinition",
                        Recommendation = "REUSE",
                        TargetComponent = action.RelatedStep,
                        ConfidenceScore = 0.80,
                        Rationale = $"Existing step '{action.RelatedStep}' covers this behavior."
                    });
                }
            }

            // Feature decision: CREATE new feature or REUSE existing
            decisions.Add(new IntelligenceDecision
            {
                ActionIndex = -1,
                ActionDescription = "Feature File",
                DecisionType = "Feature",
                Recommendation = "CREATE",
                TargetComponent = "New Feature file",
                ConfidenceScore = 0.75,
                Rationale = "Recommend creating a new BDD feature to document the recorded business flow."
            });

            return decisions;
        }

        private double CalculateFlowConfidence(RecordingIntelligenceModel recording)
        {
            if (recording?.Actions == null || recording.Actions.Count == 0)
                return 0.0;

            var matchedActions = recording.Actions.Count(a =>
                !string.IsNullOrEmpty(a.InferredPageContext) &&
                a.InferredPageContext != "Unknown");

            return (double)matchedActions / recording.Actions.Count;
        }

        private string GenerateFeatureName(List<string> pages)
        {
            if (!pages.Any())
                return "Automation";

            // ViewDashboard → ViewDashboard
            // ViewDashboard, ViewDeal → ViewDashboard_And_ViewDeal
            var nonUnknownPages = pages.Where(p => p != "Unknown").ToList();

            if (nonUnknownPages.Count == 1)
                return nonUnknownPages.First();

            return string.Join("_And_", nonUnknownPages);
        }
    }
}
