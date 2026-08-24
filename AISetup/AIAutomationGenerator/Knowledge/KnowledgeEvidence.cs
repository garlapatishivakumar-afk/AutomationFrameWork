using System;
using System.Collections.Generic;

namespace AIAutomationGenerator.Knowledge
{
    /// <summary>
    /// V6.0 P2 — Evidence model.
    ///
    /// Attaches a traceable chain of repository evidence to each intelligence
    /// decision. Every decision that depends on repository knowledge MUST carry
    /// at least one KnowledgeEvidence item. If none exists, it must report
    /// NO_REPOSITORY_EVIDENCE explicitly rather than silently proceeding.
    /// </summary>
    public class KnowledgeEvidence
    {
        public string KnowledgeId       { get; set; }   // KnowledgeItem.Id
        public KnowledgeSourceType SourceType { get; set; }
        public string SourcePath        { get; set; }
        public string Page              { get; set; }
        public string Component         { get; set; }
        public string RetrievalReason   { get; set; }   // "page-match" | "locator-match"
        public string EvidenceText      { get; set; }   // human-readable description
        public double Relevance         { get; set; }   // 0.0–1.0, deterministic
        public ConfidenceLevel Confidence { get; set; }
        public bool   IsDirect          { get; set; }   // false = inferred
    }

    public enum ConfidenceLevel { High, Medium, Low, Unknown }

    /// <summary>
    /// Conflict between two knowledge items that cannot be resolved deterministically.
    /// Escalated to the existing human-review boundary.
    /// </summary>
    public class KnowledgeConflict
    {
        public string ConflictId   { get; set; } = Guid.NewGuid().ToString("N")[..8];
        public string Description  { get; set; }
        public List<KnowledgeItem> ConflictingItems { get; set; } = new();
        public string Resolution   { get; set; } = "HUMAN_REVIEW_REQUIRED";
    }

    /// <summary>
    /// Knowledge-enriched intelligence metrics (P2 additions).
    /// </summary>
    public class KnowledgeIntelligenceMetrics
    {
        public int    RetrievedKnowledgeCount     { get; set; }
        public int    UsedKnowledgeCount          { get; set; }
        public int    UnusedKnowledgeCount        { get; set; }
        public int    EvidenceCount               { get; set; }
        public int    DecisionsWithEvidence       { get; set; }
        public int    DecisionsWithoutEvidence    { get; set; }
        public int    KnowledgeConflicts          { get; set; }
        public long   RetrievalDurationMs         { get; set; }
        public string TokenMeasurement            { get; set; } = "NOT_AVAILABLE";
    }
}
