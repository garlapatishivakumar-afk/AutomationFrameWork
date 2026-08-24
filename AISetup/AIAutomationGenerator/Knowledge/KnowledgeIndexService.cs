using System;
using System.Collections.Generic;
using System.Linq;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Knowledge
{
    /// <summary>
    /// V6.0 P1 — Builds an indexed knowledge base from an existing
    /// RepositoryKnowledgeModel (already filtered by RelevantContextSelector).
    ///
    /// Uses the already-filtered slice — does NOT re-scan the repository.
    /// Index is deterministic: same input → same output.
    /// </summary>
    public class KnowledgeIndexService
    {
        /// <summary>
        /// Build a flat, queryable knowledge index from the filtered repository slice.
        /// Every item has full source traceability.
        /// </summary>
        public KnowledgeIndex Build(RepositoryKnowledgeModel filteredRepository)
        {
            if (filteredRepository == null)
                throw new ArgumentNullException(nameof(filteredRepository));

            var items = new List<KnowledgeItem>();

            // Page elements → KnowledgeItem
            foreach (var pe in filteredRepository.PageElements ?? new())
            {
                items.Add(new KnowledgeItem
                {
                    SourceType    = KnowledgeSourceType.PageElement,
                    SourcePath    = pe.FilePath,
                    PageOwnership = pe.PageOwnership,
                    ComponentName = pe.Name,
                    Description   = $"{pe.LocatorType ?? "locator"} — {pe.Selector ?? pe.Name}",
                    LocatorValue  = pe.Selector,
                    Confidence    = pe.ConfidenceScore,
                    IsInferred    = false,
                    RelevantPages = string.IsNullOrEmpty(pe.PageOwnership)
                        ? Array.Empty<string>() : new[] { pe.PageOwnership }
                });
            }

            // Page actions → KnowledgeItem
            foreach (var pa in filteredRepository.PageActions ?? new())
            {
                items.Add(new KnowledgeItem
                {
                    SourceType    = KnowledgeSourceType.PageAction,
                    SourcePath    = pa.FilePath,
                    PageOwnership = pa.PageOwnership,
                    ComponentName = pa.Name,
                    Description   = $"{(pa.IsAsync ? "async " : "")}method — {pa.Parameters ?? "()"}",
                    Confidence    = pa.ConfidenceScore,
                    IsInferred    = false,
                    RelevantPages = string.IsNullOrEmpty(pa.PageOwnership)
                        ? Array.Empty<string>() : new[] { pa.PageOwnership }
                });
            }

            // Step definitions → KnowledgeItem
            foreach (var sd in filteredRepository.StepDefinitions ?? new())
            {
                items.Add(new KnowledgeItem
                {
                    SourceType    = KnowledgeSourceType.StepDefinition,
                    SourcePath    = sd.FilePath,
                    PageOwnership = sd.PageOwnership,
                    ComponentName = sd.StepText,
                    Description   = $"Step: {sd.StepText}",
                    Confidence    = sd.ConfidenceScore,
                    IsInferred    = false,
                    RelevantPages = string.IsNullOrEmpty(sd.PageOwnership)
                        ? Array.Empty<string>() : new[] { sd.PageOwnership }
                });
            }

            // Feature files → KnowledgeItem
            foreach (var ff in filteredRepository.Features ?? new())
            {
                items.Add(new KnowledgeItem
                {
                    SourceType    = KnowledgeSourceType.FeatureFile,
                    SourcePath    = ff.FilePath,
                    ComponentName = ff.FeatureName,
                    Description   = $"Feature: {ff.FeatureName}",
                    IsInferred    = false,
                    RelevantPages = ff.RelatedPages?.ToArray() ?? Array.Empty<string>()
                });
            }

            // Page relationships → KnowledgeItem (inferred)
            foreach (var rel in filteredRepository.PageRelationships ?? new())
            {
                items.Add(new KnowledgeItem
                {
                    SourceType    = KnowledgeSourceType.PageRelationship,
                    PageOwnership = rel.PageName,
                    ComponentName = rel.PageName,
                    Description   = $"Page '{rel.PageName}' — {rel.PageElementFiles.Count} element file(s), {rel.PageActionFiles.Count} action file(s)",
                    IsInferred    = true,   // relationship is inferred from structure
                    RelevantPages = new[] { rel.PageName }
                });
            }

            return new KnowledgeIndex
            {
                Items       = items,
                BuiltAt     = DateTime.UtcNow,
                SourceRoot  = filteredRepository.RepositoryRoot
            };
        }
    }

    /// <summary>
    /// In-memory knowledge index. Queryable, deterministic.
    /// </summary>
    public class KnowledgeIndex
    {
        public List<KnowledgeItem> Items  { get; set; } = new();
        public DateTime            BuiltAt { get; set; }
        public string              SourceRoot { get; set; }

        public int TotalItems => Items.Count;
        public bool IsEmpty   => Items.Count == 0;

        // ===== Query helpers =====

        public IEnumerable<KnowledgeItem> ByPage(string page) =>
            string.IsNullOrEmpty(page) ? Enumerable.Empty<KnowledgeItem>()
            : Items.Where(i => i.RelevantPages.Any(p =>
                  string.Equals(p, page, StringComparison.OrdinalIgnoreCase)));

        public IEnumerable<KnowledgeItem> BySourceType(KnowledgeSourceType t) =>
            Items.Where(i => i.SourceType == t);

        public IEnumerable<KnowledgeItem> ByLocator(string locatorFragment) =>
            string.IsNullOrEmpty(locatorFragment) ? Enumerable.Empty<KnowledgeItem>()
            : Items.Where(i => !string.IsNullOrEmpty(i.LocatorValue) &&
                  i.LocatorValue.Contains(locatorFragment, StringComparison.OrdinalIgnoreCase));
    }
}
