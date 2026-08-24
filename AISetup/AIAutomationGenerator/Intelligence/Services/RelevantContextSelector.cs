using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Intelligence.Services
{
    /// <summary>
    /// V5.0 Prompt 1 — Context Minimization.
    ///
    /// Selects only the framework components that are relevant to the current
    /// recording, before those components enter the intelligence pipeline.
    ///
    /// WHY THIS EXISTS:
    ///   V4.0 passed the entire RepositoryKnowledgeModel (all PageElements,
    ///   PageActions, StepDefinitions) through every pipeline stage, even when
    ///   a recording only touches 2 of 5 pages.  Filtering happened only at
    ///   GenerationContextBuilder time — too late to reduce what gets enriched.
    ///
    /// WHAT IT DOES:
    ///   1. Derives the complete set of pages referenced by the recording using
    ///      ALL available signals: URL paths, link-click names, id-selector page
    ///      fragments, and page-context transitions.
    ///   2. Returns a filtered RepositoryKnowledgeModel slice containing only
    ///      components whose PageOwnership matches those pages.
    ///   3. Emits deterministic metrics (no estimates, no token claims).
    ///
    /// WHAT IT DOES NOT DO:
    ///   - Does not modify the production AutomationFrameWork.
    ///   - Does not hardcode the current recording's application/pages.
    ///   - Does not claim token savings unless actual LLM measurement exists.
    ///   - Does not redesign P1/P2/P3.
    /// </summary>
    public class RelevantContextSelector
    {
        // ===== Public API =====

        /// <summary>
        /// Select only the framework components relevant to <paramref name="recordingActions"/>.
        /// Returns a filtered slice of <paramref name="fullIndex"/> plus measurable metrics.
        /// </summary>
        public ContextSelectionResult SelectRelevantContext(
            RepositoryKnowledgeModel fullIndex,
            List<RecordedActionIntelligence> recordingActions)
        {
            if (fullIndex == null)
                throw new ArgumentNullException(nameof(fullIndex));

            if (recordingActions == null || recordingActions.Count == 0)
            {
                return ContextSelectionResult.Empty(fullIndex);
            }

            var start = DateTime.UtcNow;

            // Step 1: Derive all page signals from the recording
            var inferredPages = DerivePageSignals(recordingActions);

            // Step 2: Filter the full index to the relevant slice
            var filteredElements   = FilterPageElements(fullIndex.PageElements, inferredPages);
            var filteredActions    = FilterPageActions(fullIndex.PageActions, inferredPages);
            var filteredSteps      = FilterStepDefinitions(fullIndex.StepDefinitions, inferredPages);
            var filteredFeatures   = FilterFeatures(fullIndex.Features, inferredPages);
            var filteredRelations  = FilterRelationships(fullIndex.PageRelationships, inferredPages);

            var filteredIndex = new RepositoryKnowledgeModel
            {
                RepositoryRoot      = fullIndex.RepositoryRoot,
                LastScanTime        = fullIndex.LastScanTime,
                RepositorySignature = fullIndex.RepositorySignature,
                FrameworkStructure  = fullIndex.FrameworkStructure,
                PageElements        = filteredElements,
                PageActions         = filteredActions,
                StepDefinitions     = filteredSteps,
                Features            = filteredFeatures,
                PageRelationships   = filteredRelations
            };

            var duration = DateTime.UtcNow - start;

            return new ContextSelectionResult
            {
                FilteredIndex       = filteredIndex,
                InferredPages       = inferredPages,
                Metrics             = BuildMetrics(fullIndex, filteredIndex, inferredPages, recordingActions, duration)
            };
        }

        // ===== Page signal derivation =====

        /// <summary>
        /// Derives the set of relevant pages from ALL available signals in the recording.
        /// Generic — not tied to the current application.
        ///
        /// Signals used (in priority order):
        ///   1. InferredPageContext already set on actions (from CodegenParser)
        ///   2. URL path segments from navigate actions
        ///   3. Link-click target names (role=link actions)
        ///   4. Id-selector segments after ASP.NET prefix stripping
        /// </summary>
        public IReadOnlyList<string> DerivePageSignals(List<RecordedActionIntelligence> actions)
        {
            var pages = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var action in actions)
            {
                // Signal 1: already inferred (from CodegenParser URL/link-click logic)
                if (!string.IsNullOrEmpty(action.InferredPageContext))
                    pages.Add(action.InferredPageContext);

                // Signal 2: URL path segment
                if (action.ActionType == "navigate" && !string.IsNullOrEmpty(action.LocatorValue))
                {
                    var segment = ExtractPageFromUrl(action.LocatorValue);
                    if (!string.IsNullOrEmpty(segment))
                        pages.Add(segment);
                }

                // Signal 3: link names as page candidates
                if (action.LocatorType == "role" && action.ActionType == "click"
                    && !string.IsNullOrEmpty(action.GetByRoleName))
                {
                    var candidate = ToPascalCase(action.GetByRoleName);
                    if (candidate.Length >= 3)  // avoid tiny fragments
                        pages.Add(candidate);
                }

                // Signal 4: id-selector page fragment
                if (action.LocatorType == "id" && !string.IsNullOrEmpty(action.LocatorValue))
                {
                    var fragment = ExtractPageFragmentFromId(action.LocatorValue);
                    if (!string.IsNullOrEmpty(fragment))
                        pages.Add(fragment);
                }
            }

            // Remove generic noise words that don't represent real pages
            var noise = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                { "Home", "Default", "Index", "Unknown", "Page", "Main" };
            pages.ExceptWith(noise);

            return pages.OrderBy(p => p).ToList();
        }

        // ===== Filtering helpers =====

        private List<PageElementInfo> FilterPageElements(
            List<PageElementInfo> all, IReadOnlyList<string> pages)
        {
            if (all == null) return new();

            // Include elements whose PageOwnership matches any inferred page,
            // plus any element with no ownership (shared/common elements).
            return all.Where(e =>
                string.IsNullOrEmpty(e.PageOwnership) ||
                pages.Any(p => string.Equals(p, e.PageOwnership, StringComparison.OrdinalIgnoreCase) ||
                               e.PageOwnership.StartsWith(p, StringComparison.OrdinalIgnoreCase) ||
                               p.StartsWith(e.PageOwnership, StringComparison.OrdinalIgnoreCase)))
            .ToList();
        }

        private List<PageActionInfo> FilterPageActions(
            List<PageActionInfo> all, IReadOnlyList<string> pages)
        {
            if (all == null) return new();

            return all.Where(a =>
                string.IsNullOrEmpty(a.PageOwnership) ||
                pages.Any(p => string.Equals(p, a.PageOwnership, StringComparison.OrdinalIgnoreCase) ||
                               a.PageOwnership.StartsWith(p, StringComparison.OrdinalIgnoreCase) ||
                               p.StartsWith(a.PageOwnership, StringComparison.OrdinalIgnoreCase)))
            .ToList();
        }

        private List<StepDefinitionInfo> FilterStepDefinitions(
            List<StepDefinitionInfo> all, IReadOnlyList<string> pages)
        {
            if (all == null) return new();

            return all.Where(s =>
                string.IsNullOrEmpty(s.PageOwnership) ||
                pages.Any(p => string.Equals(p, s.PageOwnership, StringComparison.OrdinalIgnoreCase) ||
                               s.PageOwnership.StartsWith(p, StringComparison.OrdinalIgnoreCase) ||
                               p.StartsWith(s.PageOwnership, StringComparison.OrdinalIgnoreCase)))
            .ToList();
        }

        private List<FeatureFileInfo> FilterFeatures(
            List<FeatureFileInfo> all, IReadOnlyList<string> pages)
        {
            if (all == null) return new();

            // FeatureFileInfo uses RelatedPages (list), not PageOwnership
            return all.Where(f =>
                f.RelatedPages == null || f.RelatedPages.Count == 0 ||
                f.RelatedPages.Any(rp => pages.Any(p =>
                    string.Equals(p, rp, StringComparison.OrdinalIgnoreCase) ||
                    rp.StartsWith(p, StringComparison.OrdinalIgnoreCase) ||
                    p.StartsWith(rp, StringComparison.OrdinalIgnoreCase))))
            .ToList();
        }

        private List<PageComponentRelationship> FilterRelationships(
            List<PageComponentRelationship> all, IReadOnlyList<string> pages)
        {
            if (all == null) return new();

            return all.Where(r =>
                pages.Any(p => string.Equals(p, r.PageName, StringComparison.OrdinalIgnoreCase) ||
                               r.PageName.StartsWith(p, StringComparison.OrdinalIgnoreCase) ||
                               p.StartsWith(r.PageName, StringComparison.OrdinalIgnoreCase)))
            .ToList();
        }

        // ===== Signal extraction helpers =====

        private string ExtractPageFromUrl(string url)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
                return null;
            var path    = uri.LocalPath.TrimStart('/');
            var segment = System.IO.Path.GetFileNameWithoutExtension(path);
            return string.IsNullOrEmpty(segment) ? null : ToPascalCase(segment);
        }

        private static readonly Regex AspNetIdPattern =
            new(@"[Cc]ontent[Pp]lace[Hh]older\d*_?|ctl\d+_?", RegexOptions.Compiled);

        /// <summary>
        /// Extracts a meaningful page-like fragment from an ASP.NET id selector.
        /// e.g. #ctl00_ContentPlaceHolder1_ddlSearchUser → "Search" (first word of ddl body)
        /// Returns null when no page-relevant fragment can be identified.
        /// </summary>
        private string ExtractPageFragmentFromId(string selector)
        {
            if (!selector.StartsWith("#")) return null;

            var id = AspNetIdPattern.Replace(selector.TrimStart('#'), "");
            var parts = id.Split(new[] { '_' }, StringSplitOptions.RemoveEmptyEntries);

            // Take first part that is >3 chars, skip control-type prefixes (ddl, chk, txt, btn…)
            var candidate = parts.FirstOrDefault(p =>
                p.Length > 3 &&
                !Regex.IsMatch(p, @"^\d+$") &&
                !Regex.IsMatch(p, @"^(ddl|chk|txt|btn|lnk|lbl|grd|rg|ctl)", RegexOptions.IgnoreCase));

            return candidate == null ? null : ToPascalCase(candidate);
        }

        private static string ToPascalCase(string s)
        {
            if (string.IsNullOrEmpty(s)) return s;
            var parts = s.Split(new[] { ' ', '-', '_' }, StringSplitOptions.RemoveEmptyEntries);
            return string.Concat(parts.Select(p => char.ToUpper(p[0]) + p.Substring(1)));
        }

        // ===== Metrics =====

        private ContextSelectionMetrics BuildMetrics(
            RepositoryKnowledgeModel full,
            RepositoryKnowledgeModel filtered,
            IReadOnlyList<string> inferredPages,
            List<RecordedActionIntelligence> actions,
            TimeSpan duration)
        {
            int totalElements   = full.PageElements?.Count   ?? 0;
            int totalActions    = full.PageActions?.Count    ?? 0;
            int totalSteps      = full.StepDefinitions?.Count ?? 0;
            int totalFeatures   = full.Features?.Count       ?? 0;
            int totalComponents = totalElements + totalActions + totalSteps + totalFeatures;

            int selElements   = filtered.PageElements?.Count   ?? 0;
            int selActions    = filtered.PageActions?.Count    ?? 0;
            int selSteps      = filtered.StepDefinitions?.Count ?? 0;
            int selFeatures   = filtered.Features?.Count       ?? 0;
            int selComponents = selElements + selActions + selSteps + selFeatures;

            return new ContextSelectionMetrics
            {
                RecordingActionCount      = actions.Count,
                InferredPageCount         = inferredPages.Count,
                InferredPages             = inferredPages.ToList(),

                TotalPageElements         = totalElements,
                TotalPageActions          = totalActions,
                TotalStepDefinitions      = totalSteps,
                TotalFeatures             = totalFeatures,
                TotalComponentsConsidered = totalComponents,

                SelectedPageElements      = selElements,
                SelectedPageActions       = selActions,
                SelectedStepDefinitions   = selSteps,
                SelectedFeatures          = selFeatures,
                SelectedComponentsTotal   = selComponents,

                ReductionPercent          = totalComponents == 0 ? 0.0
                    : Math.Round(100.0 * (totalComponents - selComponents) / totalComponents, 1),

                SelectionDurationMs       = (long)duration.TotalMilliseconds,

                TokenMeasurement          = "NOT_AVAILABLE — no LLM instrumentation in current pipeline"
            };
        }
    }

    // ===== Result types =====

    /// <summary>
    /// Result of RelevantContextSelector.SelectRelevantContext().
    /// Contains the filtered index plus all measurable metrics.
    /// </summary>
    public class ContextSelectionResult
    {
        /// <summary>Filtered RepositoryKnowledgeModel — only relevant components.</summary>
        public RepositoryKnowledgeModel FilteredIndex { get; set; }

        /// <summary>Page names inferred from ALL signals in the recording.</summary>
        public IReadOnlyList<string> InferredPages { get; set; } = new List<string>();

        /// <summary>Deterministic metrics — no token estimates, no guesses.</summary>
        public ContextSelectionMetrics Metrics { get; set; }

        public static ContextSelectionResult Empty(RepositoryKnowledgeModel full) => new()
        {
            FilteredIndex = full,
            InferredPages = new List<string>(),
            Metrics       = new ContextSelectionMetrics
            {
                TokenMeasurement = "NOT_AVAILABLE — no LLM instrumentation in current pipeline"
            }
        };
    }

    /// <summary>
    /// Deterministic, measurable context-reduction metrics.
    /// All numbers are exact counts, not estimates.
    /// Token measurement is explicitly flagged as NOT_AVAILABLE.
    /// </summary>
    public class ContextSelectionMetrics
    {
        // Recording
        public int RecordingActionCount       { get; set; }
        public int InferredPageCount          { get; set; }
        public List<string> InferredPages     { get; set; } = new();

        // Before selection (full repository)
        public int TotalPageElements          { get; set; }
        public int TotalPageActions           { get; set; }
        public int TotalStepDefinitions       { get; set; }
        public int TotalFeatures              { get; set; }
        public int TotalComponentsConsidered  { get; set; }

        // After selection (relevant slice)
        public int SelectedPageElements       { get; set; }
        public int SelectedPageActions        { get; set; }
        public int SelectedStepDefinitions    { get; set; }
        public int SelectedFeatures           { get; set; }
        public int SelectedComponentsTotal    { get; set; }

        // Reduction
        public double ReductionPercent        { get; set; }
        public long   SelectionDurationMs     { get; set; }

        // Honest token measurement status
        public string TokenMeasurement        { get; set; } = "NOT_AVAILABLE";
    }
}
