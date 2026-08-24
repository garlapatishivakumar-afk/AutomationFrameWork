using System;
using System.Collections.Generic;
using System.Linq;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Intelligence.Services;

namespace AIAutomationGenerator.Knowledge
{
    /// <summary>
    /// V6.0 P1 — Retrieves only knowledge relevant to the current recording.
    ///
    /// Reuses V5.0 page signals (InferredPageContext, LocatorValue, etc.)
    /// rather than creating a second page-selection algorithm.
    ///
    /// Retrieval is DETERMINISTIC: same inputs → same outputs.
    /// Only returns knowledge that exists in the indexed repository.
    /// Never fabricates or invents items.
    /// </summary>
    public class KnowledgeRetrievalService
    {
        /// <summary>
        /// Retrieve knowledge relevant to the given recording actions from the index.
        /// Uses the same page signals that RelevantContextSelector already computed.
        /// </summary>
        public KnowledgeRetrievalResult Retrieve(
            KnowledgeIndex index,
            IReadOnlyList<string> inferredPages,
            IEnumerable<RecordedActionIntelligence> actions)
        {
            if (index == null || index.IsEmpty)
            {
                return new KnowledgeRetrievalResult
                {
                    Items   = new List<KnowledgeItem>(),
                    Metrics = new KnowledgeRetrievalMetrics
                    {
                        TotalIndexedItems = 0,
                        TokenMeasurement  = "NOT_AVAILABLE"
                    }
                };
            }

            var start    = DateTime.UtcNow;
            var actionList = actions?.ToList() ?? new();

            // Step 1: derive locator fragments from recording actions
            var locatorFragments = actionList
                .Where(a => !string.IsNullOrEmpty(a.LocatorValue))
                .Select(a => a.LocatorValue)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            // Step 2: collect candidate items by page membership
            var byPage = index.Items
                .Where(i => i.RelevantPages.Any(p =>
                    inferredPages.Any(ip => string.Equals(ip, p, StringComparison.OrdinalIgnoreCase))))
                .ToList();

            // Step 3: additionally collect items whose locator matches a recording locator
            var byLocator = index.Items
                .Where(i => !string.IsNullOrEmpty(i.LocatorValue) &&
                            locatorFragments.Any(lf =>
                                i.LocatorValue.Contains(lf, StringComparison.OrdinalIgnoreCase) ||
                                lf.Contains(i.LocatorValue, StringComparison.OrdinalIgnoreCase)))
                .ToList();

            // Step 4: union, deduplicating by Id — deterministic (ordered by SourceType then ComponentName)
            var retrieved = byPage.Union(byLocator, new KnowledgeItemIdComparer())
                .OrderBy(i => i.SourceType)
                .ThenBy(i => i.ComponentName)
                .ToList();

            var duration = DateTime.UtcNow - start;

            var metrics = new KnowledgeRetrievalMetrics
            {
                TotalIndexedItems          = index.TotalItems,
                CandidateItems             = byPage.Count + byLocator.Count,
                RetrievedItems             = retrieved.Count,
                RetrievalReductionPercent  = index.TotalItems == 0 ? 0
                    : Math.Round(100.0 * (index.TotalItems - retrieved.Count) / index.TotalItems, 1),
                RetrievalDurationMs        = (long)duration.TotalMilliseconds,
                InferredPageCount          = inferredPages.Count,
                InferredPages              = inferredPages.ToList(),
                SourceTypes                = retrieved.Select(i => i.SourceType.ToString())
                                                       .Distinct().OrderBy(s => s).ToList(),
                TokenMeasurement           = "NOT_AVAILABLE"
            };

            return new KnowledgeRetrievalResult { Items = retrieved, Metrics = metrics };
        }

        private sealed class KnowledgeItemIdComparer : IEqualityComparer<KnowledgeItem>
        {
            public bool Equals(KnowledgeItem x, KnowledgeItem y) => x?.Id == y?.Id;
            public int  GetHashCode(KnowledgeItem obj) => obj.Id?.GetHashCode() ?? 0;
        }
    }
}
