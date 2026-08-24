using System;
using System.Collections.Generic;
using AIAutomationGenerator.Intelligence.Services;

namespace AIAutomationGenerator.Intelligence.Models
{
    /// <summary>
    /// Unified intelligence result that brings together all V4.0 Prompt 1 knowledge.
    /// This is the input to V4.0 Prompt 2 (Generation).
    /// Designed to be compact and avoid duplicating source code.
    ///
    /// V5.0 P1 addition: ContextSelection carries the metrics from RelevantContextSelector,
    /// documenting exactly how many components were considered vs selected.
    /// RepositoryKnowledge is now the FILTERED slice, not the full index.
    /// </summary>
    public class AutomationIntelligenceModel
    {
        public string AnalysisTimestamp { get; set; }
        public string RepositoryRoot { get; set; }

        // Repository knowledge — V5.0: filtered slice (only relevant components)
        public RepositoryKnowledgeModel RepositoryKnowledge { get; set; }

        // V5.0 P1: context selection metrics (how much was reduced)
        public ContextSelectionMetrics ContextSelection { get; set; }

        // Recording intelligence
        public RecordingIntelligenceModel RecordingIntelligence { get; set; }

        // Business flow analysis
        public List<BusinessFlowIntelligence> BusinessFlows { get; set; } = new();

        // Extracted relationships for easy consumption by generator
        public List<IntelligenceDecision> Decisions { get; set; } = new();

        // Summary statistics
        public int TotalPagesInRepository => RepositoryKnowledge?.TotalPages ?? 0;
        public int TotalPageElements => RepositoryKnowledge?.PageElements?.Count ?? 0;
        public int TotalPageActions => RepositoryKnowledge?.PageActions?.Count ?? 0;
        public int TotalStepDefinitions => RepositoryKnowledge?.StepDefinitions?.Count ?? 0;
        public int RecordingActionCount => RecordingIntelligence?.Actions?.Count ?? 0;

        public bool IsValid =>
            RepositoryKnowledge != null &&
            RecordingIntelligence != null;
    }

    /// <summary>
    /// Business flow detected from recording + repository analysis.
    /// </summary>
    public class BusinessFlowIntelligence
    {
        public string FlowName { get; set; }
        public List<string> InvolvedPages { get; set; } = new();
        public List<int> ActionSequences { get; set; } = new(); // Action indices
        public double ConfidenceScore { get; set; }
        public string FeatureName { get; set; } // Potential feature name
    }

    /// <summary>
    /// A single intelligence-driven decision for the generator.
    /// Example: "For action[3] click SearchQueueButton, reuse ViewDashboardObjects.SearchQueueButton"
    /// </summary>
    public class IntelligenceDecision
    {
        public int ActionIndex { get; set; }
        public string ActionDescription { get; set; }
        public string DecisionType { get; set; } // "PageElement", "PageAction", "StepDefinition", "Feature"
        public string Recommendation { get; set; } // "REUSE", "EXTEND", "CREATE"
        public string TargetComponent { get; set; } // e.g., "ViewDashboardObjects.SearchQueueButton"
        public string TargetFile { get; set; } // Full path if CREATE
        public double ConfidenceScore { get; set; }
        public string Rationale { get; set; }
    }
}
