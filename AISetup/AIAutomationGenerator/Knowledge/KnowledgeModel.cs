using System;
using System.Collections.Generic;

namespace AIAutomationGenerator.Knowledge
{
    /// <summary>
    /// V6.0 Prompt 1 — Knowledge model.
    ///
    /// Represents a single item of framework knowledge with full source
    /// traceability. Wraps existing RepositoryKnowledgeModel data — does
    /// NOT duplicate the model itself.
    ///
    /// Every item must carry its source so the system can answer:
    ///   "Why was this knowledge retrieved?"
    /// </summary>
    public class KnowledgeItem
    {
        public string   Id           { get; set; } = Guid.NewGuid().ToString("N")[..8];
        public KnowledgeSourceType SourceType { get; set; }
        public string   SourcePath   { get; set; }   // actual file path in repository
        public string   PageOwnership { get; set; }  // e.g. "ViewDashboard"
        public string   ComponentName { get; set; }  // class or method name
        public string   Description  { get; set; }   // human-readable summary
        public string   LocatorValue { get; set; }   // raw selector/locator when applicable
        public double   Confidence   { get; set; } = 1.0;
        public bool     IsInferred   { get; set; }   // true = derived, false = directly sourced
        public string[] RelevantPages { get; set; } = Array.Empty<string>();
    }

    public enum KnowledgeSourceType
    {
        PageElement,
        PageAction,
        StepDefinition,
        FeatureFile,
        FrameworkConvention,
        BusinessRule,
        PageRelationship
    }

    /// <summary>
    /// Output of KnowledgeRetrievalService — a filtered, traceable slice.
    /// </summary>
    public class KnowledgeRetrievalResult
    {
        public IReadOnlyList<KnowledgeItem> Items    { get; set; } = new List<KnowledgeItem>();
        public KnowledgeRetrievalMetrics    Metrics  { get; set; } = new();
        public bool                         IsEmpty  => Items.Count == 0;
    }

    /// <summary>
    /// Deterministic metrics for one retrieval operation.
    /// No token counts — V6.0 P1 has no LLM.
    /// </summary>
    public class KnowledgeRetrievalMetrics
    {
        public int    TotalIndexedItems       { get; set; }
        public int    CandidateItems          { get; set; }
        public int    RetrievedItems          { get; set; }
        public double RetrievalReductionPercent { get; set; }
        public long   RetrievalDurationMs    { get; set; }
        public int    InferredPageCount       { get; set; }
        public List<string> InferredPages     { get; set; } = new();
        public List<string> SourceTypes       { get; set; } = new();
        public string TokenMeasurement        { get; set; } = "NOT_AVAILABLE";
    }
}
