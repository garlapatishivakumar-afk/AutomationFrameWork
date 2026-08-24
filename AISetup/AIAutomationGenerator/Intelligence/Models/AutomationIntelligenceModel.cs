using System;
using System.Collections.Generic;
using AIAutomationGenerator.Intelligence.Services;
using AIAutomationGenerator.Knowledge;

namespace AIAutomationGenerator.Intelligence.Models
{
    /// <summary>
    /// Unified intelligence result.
    ///
    /// V5.0 P1: ContextSelection metrics, filtered RepositoryKnowledge.
    /// V6.0 P2: RetrievedKnowledge, Evidence, KnowledgeMetrics — all optional
    ///          to preserve full backward compatibility with V5.0 pipeline.
    /// </summary>
    public class AutomationIntelligenceModel
    {
        public string AnalysisTimestamp { get; set; }
        public string RepositoryRoot { get; set; }

        // Repository knowledge — V5.0: filtered slice (only relevant components)
        public RepositoryKnowledgeModel RepositoryKnowledge { get; set; }

        // V5.0 P1: context selection metrics
        public ContextSelectionMetrics ContextSelection { get; set; }

        // Recording intelligence
        public RecordingIntelligenceModel RecordingIntelligence { get; set; }

        // Business flow analysis
        public List<BusinessFlowIntelligence> BusinessFlows { get; set; } = new();

        // Extracted relationships for easy consumption by generator
        public List<IntelligenceDecision> Decisions { get; set; } = new();

        // V6.0 P2: Retrieved knowledge items (optional — null when V5 path used)
        public KnowledgeRetrievalResult RetrievedKnowledge { get; set; }

        // V6.0 P2: Evidence attached to decisions (keyed by decision ActionIndex)
        public Dictionary<int, List<KnowledgeEvidence>> DecisionEvidence { get; set; } = new();

        // V6.0 P2: Conflicts that require human review
        public List<KnowledgeConflict> KnowledgeConflicts { get; set; } = new();

        // V6.0 P2: Knowledge-enrichment metrics
        public KnowledgeIntelligenceMetrics KnowledgeMetrics { get; set; }

        // Summary statistics
        public int TotalPagesInRepository => RepositoryKnowledge?.TotalPages ?? 0;
        public int TotalPageElements => RepositoryKnowledge?.PageElements?.Count ?? 0;
        public int TotalPageActions => RepositoryKnowledge?.PageActions?.Count ?? 0;
        public int TotalStepDefinitions => RepositoryKnowledge?.StepDefinitions?.Count ?? 0;
        public int RecordingActionCount => RecordingIntelligence?.Actions?.Count ?? 0;

        // V6.0 P2 helpers
        public bool HasKnowledgeEnrichment => RetrievedKnowledge != null;
        public int  EvidenceCount => DecisionEvidence.Values.Sum(l => l.Count);

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
