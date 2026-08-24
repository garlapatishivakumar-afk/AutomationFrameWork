using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
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

            // Step 1: find strong action-signal matches that can recover the owning page.
            var signalMatches = index.Items
                .Where(item => actionList.Any(action => IsStrongMatch(action, item)))
                .ToList();

            var matchedPages = new HashSet<string>(inferredPages ?? Array.Empty<string>(), StringComparer.OrdinalIgnoreCase);
            foreach (var page in signalMatches
                .SelectMany(GetRelevantPages)
                .Where(page => !string.IsNullOrWhiteSpace(page)))
            {
                matchedPages.Add(page);
            }

            // Step 2: collect candidate items by page membership
            var byPage = index.Items
                .Where(i => i.RelevantPages.Any(p =>
                    matchedPages.Any(ip => string.Equals(ip, p, StringComparison.OrdinalIgnoreCase))))
                .ToList();

            // Step 3: union, deduplicating by Id — deterministic (ordered by SourceType then ComponentName)
            var retrieved = byPage.Union(signalMatches, new KnowledgeItemIdComparer())
                .OrderBy(i => i.SourceType)
                .ThenBy(i => i.ComponentName)
                .ToList();

            var duration = DateTime.UtcNow - start;

            var metrics = new KnowledgeRetrievalMetrics
            {
                TotalIndexedItems          = index.TotalItems,
                CandidateItems             = byPage.Count + signalMatches.Count,
                RetrievedItems             = retrieved.Count,
                RetrievalReductionPercent  = index.TotalItems == 0 ? 0
                    : Math.Round(100.0 * (index.TotalItems - retrieved.Count) / index.TotalItems, 1),
                RetrievalDurationMs        = (long)duration.TotalMilliseconds,
                InferredPageCount          = matchedPages.Count,
                InferredPages              = matchedPages.OrderBy(p => p).ToList(),
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

        private static IEnumerable<string> GetRelevantPages(KnowledgeItem item)
        {
            if (!string.IsNullOrWhiteSpace(item.PageOwnership))
                yield return item.PageOwnership;

            foreach (var page in item.RelevantPages ?? Array.Empty<string>())
            {
                if (!string.IsNullOrWhiteSpace(page))
                    yield return page;
            }
        }

        private static bool IsStrongMatch(RecordedActionIntelligence action, KnowledgeItem item)
        {
            if (action == null || item == null)
                return false;

            if (HasExactLocatorMatch(action, item))
                return true;

            var actionSignals = GetActionSignals(action);
            var itemSignals = GetItemSignals(item).ToList();
            if (actionSignals.Count == 0 || itemSignals.Count == 0)
                return false;

            return actionSignals.Any(signal =>
                itemSignals.Any(itemSignal => string.Equals(itemSignal, signal, StringComparison.OrdinalIgnoreCase)))
                || actionSignals.Count(signal =>
                    signal.Length >= 4 && itemSignals.Any(itemSignal =>
                        itemSignal.Contains(signal, StringComparison.OrdinalIgnoreCase) ||
                        signal.Contains(itemSignal, StringComparison.OrdinalIgnoreCase))) >= 2;
        }

        private static bool HasExactLocatorMatch(RecordedActionIntelligence action, KnowledgeItem item)
        {
            if (string.IsNullOrWhiteSpace(action.LocatorValue) || string.IsNullOrWhiteSpace(item.LocatorValue))
                return false;

            var actionLocator = NormalizeLocator(action.LocatorValue);
            var itemLocator = NormalizeLocator(item.LocatorValue);
            if (string.IsNullOrWhiteSpace(actionLocator) || string.IsNullOrWhiteSpace(itemLocator))
                return false;

            return string.Equals(actionLocator, itemLocator, StringComparison.OrdinalIgnoreCase)
                || itemLocator.Contains(actionLocator, StringComparison.OrdinalIgnoreCase)
                || actionLocator.Contains(itemLocator, StringComparison.OrdinalIgnoreCase);
        }

        private static List<string> GetActionSignals(RecordedActionIntelligence action)
        {
            var signals = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            AddSignal(signals, action.Target);
            AddSignal(signals, action.GetByRoleName);
            AddSignal(signals, action.LocatorValue);
            AddSignal(signals, action.InferredPageContext);

            foreach (var urlSignal in ExtractUrlSignals(action))
                AddSignal(signals, urlSignal);

            return signals.OrderBy(signal => signal).ToList();
        }

        private static IEnumerable<string> GetItemSignals(KnowledgeItem item)
        {
            var signals = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            AddSignal(signals, item.ComponentName);
            AddSignal(signals, item.PageOwnership);
            AddSignal(signals, item.Description);
            AddSignal(signals, item.LocatorValue);
            AddSignal(signals, item.SourcePath);

            foreach (var page in item.RelevantPages ?? Array.Empty<string>())
                AddSignal(signals, page);

            return signals.OrderBy(signal => signal);
        }

        private static IEnumerable<string> ExtractUrlSignals(RecordedActionIntelligence action)
        {
            var url = string.Equals(action.ActionType, "navigate", StringComparison.OrdinalIgnoreCase)
                ? (action.Target ?? action.LocatorValue)
                : null;

            if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out var uri))
                yield break;

            foreach (var hostToken in uri.Host.Split('.', '-'))
            {
                if (hostToken.Length >= 4 &&
                    !string.Equals(hostToken, "trimont", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(hostToken, "uat", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(hostToken, "www", StringComparison.OrdinalIgnoreCase))
                {
                    yield return hostToken;
                }
            }

            var pathToken = Path.GetFileNameWithoutExtension(uri.AbsolutePath.Trim('/'));
            if (!string.IsNullOrWhiteSpace(pathToken))
                yield return pathToken;
        }

        private static void AddSignal(ISet<string> sink, string raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
                return;

            var normalized = NormalizeSignal(raw);
            if (normalized.Length >= 3)
                sink.Add(normalized);

            foreach (Match match in Regex.Matches(raw, @"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+|#[A-Za-z0-9_:-]+", RegexOptions.Compiled))
            {
                var token = match.Value.Trim('#').ToLowerInvariant();
                if (token.Length >= 3)
                    sink.Add(token);
            }
        }

        private static string NormalizeLocator(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return string.Empty;

            var literalMatch = Regex.Match(value, @"#[-_A-Za-z0-9:]+", RegexOptions.IgnoreCase);
            if (literalMatch.Success)
                return literalMatch.Value;

            return NormalizeSignal(value);
        }

        private static string NormalizeSignal(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
                return string.Empty;

            return Regex.Replace(raw, @"[^a-z0-9]+", string.Empty, RegexOptions.IgnoreCase)
                .ToLowerInvariant();
        }
    }
}
