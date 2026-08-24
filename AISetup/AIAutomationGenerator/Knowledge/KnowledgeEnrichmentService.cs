using System;
using System.Collections.Generic;
using System.Linq;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Knowledge
{
    /// <summary>
    /// V6.0 P2 — Enriches AutomationIntelligenceModel with retrieved knowledge.
    ///
    /// Attaches KnowledgeEvidence to each IntelligenceDecision. When no
    /// repository evidence exists for a decision, explicitly marks it
    /// "NO_REPOSITORY_EVIDENCE" — never silently invents a fact.
    ///
    /// Detects conflicts where two retrieved items support contradictory decisions
    /// and records them for human review.
    ///
    /// Framework files are never modified. This is read-only enrichment.
    /// </summary>
    public class KnowledgeEnrichmentService
    {
        public void Enrich(
            AutomationIntelligenceModel model,
            KnowledgeRetrievalResult retrieval)
        {
            if (model == null) throw new ArgumentNullException(nameof(model));
            if (retrieval == null)
            {
                model.KnowledgeMetrics = new KnowledgeIntelligenceMetrics
                {
                    TokenMeasurement = "NOT_AVAILABLE"
                };
                return;
            }

            model.RetrievedKnowledge = retrieval;
            var start = DateTime.UtcNow;

            var usedIds = new HashSet<string>();

            foreach (var decision in model.Decisions ?? new())
            {
                var evidence = BuildEvidenceForDecision(decision, retrieval.Items, usedIds);
                if (!model.DecisionEvidence.ContainsKey(decision.ActionIndex))
                    model.DecisionEvidence[decision.ActionIndex] = new List<KnowledgeEvidence>();
                model.DecisionEvidence[decision.ActionIndex].AddRange(evidence);
            }

            // Detect conflicts: same page, same source type, different files
            var conflicts = DetectConflicts(retrieval.Items);
            model.KnowledgeConflicts.AddRange(conflicts);

            // Compute metrics
            int usedCount  = usedIds.Count;
            int totalItems = retrieval.Items.Count;
            int decisionsWithEvidence    = model.DecisionEvidence.Count(kvp => kvp.Value.Any());
            int decisionsWithoutEvidence = (model.Decisions?.Count ?? 0) - decisionsWithEvidence;

            model.KnowledgeMetrics = new KnowledgeIntelligenceMetrics
            {
                RetrievedKnowledgeCount  = totalItems,
                UsedKnowledgeCount       = usedCount,
                UnusedKnowledgeCount     = totalItems - usedCount,
                EvidenceCount            = model.EvidenceCount,
                DecisionsWithEvidence    = decisionsWithEvidence,
                DecisionsWithoutEvidence = decisionsWithoutEvidence,
                KnowledgeConflicts       = conflicts.Count,
                RetrievalDurationMs      = retrieval.Metrics.RetrievalDurationMs,
                TokenMeasurement         = "NOT_AVAILABLE"
            };
        }

        // ===== Evidence building =====

        private List<KnowledgeEvidence> BuildEvidenceForDecision(
            IntelligenceDecision decision,
            IReadOnlyList<KnowledgeItem> items,
            HashSet<string> usedIds)
        {
            var evidence = new List<KnowledgeEvidence>();

            // Match by page ownership
            var pageMatches = items.Where(i =>
                !string.IsNullOrEmpty(decision.TargetComponent) &&
                i.RelevantPages.Any(p =>
                    decision.TargetComponent.StartsWith(p, StringComparison.OrdinalIgnoreCase) ||
                    decision.ActionDescription.Contains(p, StringComparison.OrdinalIgnoreCase)));

            // Match by component name substring
            var componentMatches = items.Where(i =>
                !string.IsNullOrEmpty(i.ComponentName) &&
                !string.IsNullOrEmpty(decision.TargetComponent) &&
                (decision.TargetComponent.Contains(i.ComponentName, StringComparison.OrdinalIgnoreCase) ||
                 i.ComponentName.Contains(decision.ActionDescription?.Split(' ').LastOrDefault() ?? "", StringComparison.OrdinalIgnoreCase)));

            var combined = pageMatches.Union(componentMatches, new KnowledgeItemIdEqComparer())
                .Take(5) // limit evidence per decision
                .ToList();

            if (combined.Count == 0)
            {
                // Explicitly record missing evidence — not silently omitted
                evidence.Add(new KnowledgeEvidence
                {
                    KnowledgeId     = "none",
                    SourceType      = KnowledgeSourceType.FrameworkConvention,
                    RetrievalReason = "NO_REPOSITORY_EVIDENCE",
                    EvidenceText    = $"No repository evidence found for decision: {decision.ActionDescription ?? "(unknown)"}",
                    IsDirect        = false,
                    Confidence      = ConfidenceLevel.Unknown,
                    Relevance       = 0.0
                });
            }
            else
            {
                foreach (var item in combined)
                {
                    usedIds.Add(item.Id);
                    evidence.Add(new KnowledgeEvidence
                    {
                        KnowledgeId     = item.Id,
                        SourceType      = item.SourceType,
                        SourcePath      = item.SourcePath,
                        Page            = item.PageOwnership,
                        Component       = item.ComponentName,
                        RetrievalReason = "page-match",
                        EvidenceText    = item.Description,
                        IsDirect        = !item.IsInferred,
                        Confidence      = item.Confidence >= 0.85 ? ConfidenceLevel.High
                                        : item.Confidence >= 0.6  ? ConfidenceLevel.Medium
                                        : ConfidenceLevel.Low,
                        Relevance       = item.Confidence
                    });
                }
            }

            return evidence;
        }

        // ===== Conflict detection =====

        private List<KnowledgeConflict> DetectConflicts(IReadOnlyList<KnowledgeItem> items)
        {
            var conflicts = new List<KnowledgeConflict>();

            // Conflict: same ComponentName, same SourceType, different SourcePaths
            var groups = items
                .Where(i => !string.IsNullOrEmpty(i.ComponentName))
                .GroupBy(i => $"{i.SourceType}|{i.ComponentName}", StringComparer.OrdinalIgnoreCase);

            foreach (var group in groups)
            {
                var distinctPaths = group
                    .Where(i => !string.IsNullOrEmpty(i.SourcePath))
                    .Select(i => i.SourcePath)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                if (distinctPaths.Count > 1)
                {
                    conflicts.Add(new KnowledgeConflict
                    {
                        Description     = $"Conflicting sources for {group.Key}: {string.Join(", ", distinctPaths)}",
                        ConflictingItems = group.ToList(),
                        Resolution      = "HUMAN_REVIEW_REQUIRED"
                    });
                }
            }

            return conflicts;
        }

        private sealed class KnowledgeItemIdEqComparer : IEqualityComparer<KnowledgeItem>
        {
            public bool Equals(KnowledgeItem x, KnowledgeItem y) => x?.Id == y?.Id;
            public int GetHashCode(KnowledgeItem o) => o.Id?.GetHashCode() ?? 0;
        }
    }
}
