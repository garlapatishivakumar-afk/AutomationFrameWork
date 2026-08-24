using System;
using System.Collections.Generic;
using System.Linq;

namespace AIAutomationGenerator.TokenCharge
{
    /// <summary>
    /// Logs Agent interaction token charges.
    /// Calculates costs on the way in, stores records in memory, and
    /// exposes them for report generation.
    ///
    /// IMPORTANT:
    ///   Copilot Agent does NOT expose per-interaction token counts
    ///   programmatically in the VS Code chat surface. Therefore:
    ///
    ///   A. When token data IS available (API, measured):
    ///      Call Log() with real counts — TokenSource = "MEASURED".
    ///
    ///   B. When token data must be imported from Copilot usage export:
    ///      Call Import() with the exported CSV/JSON row — TokenSource = "MANUAL".
    ///
    ///   C. When approximate counts are used for estimation:
    ///      Call Log() with TokenSource = "ESTIMATED" and note this clearly.
    ///
    ///   Never fabricate "MEASURED" counts that are actually guesses.
    /// </summary>
    public class TokenChargeLogger
    {
        private readonly TokenChargeCalculator _calculator;
        private readonly List<TokenChargeRecord> _records = new();

        public string DefaultVersion { get; set; } = "V5.0";
        public string DefaultModel   { get; set; } = "Claude Sonnet 4.6";

        public TokenChargeLogger(ModelPricingConfiguration config = null)
        {
            _calculator = new TokenChargeCalculator(config ?? new ModelPricingConfiguration());
        }

        // ===== Logging =====

        /// <summary>
        /// Log an interaction with raw token counts.
        /// Calculator fills TotalTokens, UsdCost, AiCredits before storing.
        /// </summary>
        public TokenChargeRecord Log(
            string interaction,
            long inputTokens,
            long outputTokens,
            long cachedInputTokens = 0,
            long cacheWriteTokens  = 0,
            string version         = null,
            string model           = null,
            string category        = null,
            string tokenSource     = "MEASURED",
            string notes           = null)
        {
            var record = new TokenChargeRecord
            {
                Date              = DateTime.UtcNow,
                Version           = version   ?? DefaultVersion,
                Interaction       = interaction,
                Category          = category  ?? "General",
                Model             = model     ?? DefaultModel,
                InputTokens       = inputTokens,
                CachedInputTokens = cachedInputTokens,
                CacheWriteTokens  = cacheWriteTokens,
                OutputTokens      = outputTokens,
                TokenSource       = tokenSource,
                Notes             = notes
            };

            _calculator.Calculate(record);
            _records.Add(record);
            return record;
        }

        /// <summary>
        /// Import a pre-populated record (from Copilot usage export or manual entry).
        /// Calculator fills TotalTokens, UsdCost, AiCredits.
        /// TokenSource should be set to "MANUAL" on the record before import.
        /// </summary>
        public TokenChargeRecord Import(TokenChargeRecord record)
        {
            if (record == null) throw new ArgumentNullException(nameof(record));
            if (string.IsNullOrEmpty(record.Version))  record.Version   = DefaultVersion;
            if (string.IsNullOrEmpty(record.Model))    record.Model     = DefaultModel;
            if (string.IsNullOrEmpty(record.TokenSource)) record.TokenSource = "MANUAL";

            _calculator.Calculate(record);
            _records.Add(record);
            return record;
        }

        // ===== Queries =====

        public IReadOnlyList<TokenChargeRecord> AllRecords     => _records;
        public int   RecordCount                               => _records.Count;

        public IEnumerable<TokenChargeRecord> ByVersion(string version) =>
            _records.Where(r => string.Equals(r.Version, version, StringComparison.OrdinalIgnoreCase));

        public IEnumerable<TokenChargeRecord> ByModel(string model) =>
            _records.Where(r => string.Equals(r.Model, model, StringComparison.OrdinalIgnoreCase));

        public IEnumerable<TokenChargeRecord> ByCategory(string category) =>
            _records.Where(r => string.Equals(r.Category, category, StringComparison.OrdinalIgnoreCase));

        // ===== Aggregates =====

        public VersionSummary SummariseVersion(string version)
        {
            var recs = ByVersion(version).ToList();
            return new VersionSummary
            {
                Version       = version,
                Interactions  = recs.Count,
                TotalTokens   = recs.Sum(r => r.TotalTokens),
                TotalUsdCost  = Math.Round(recs.Sum(r => r.UsdCost), 4),
                TotalAiCredits = Math.Round(recs.Sum(r => r.AiCredits), 2)
            };
        }

        public OverallSummary SummariseAll()
        {
            var versions = _records.Select(r => r.Version).Distinct().OrderBy(v => v).ToList();
            return new OverallSummary
            {
                VersionSummaries = versions.Select(SummariseVersion).ToList(),
                TotalInteractions = _records.Count,
                TotalTokens       = _records.Sum(r => r.TotalTokens),
                TotalUsdCost      = Math.Round(_records.Sum(r => r.UsdCost), 4),
                TotalAiCredits    = Math.Round(_records.Sum(r => r.AiCredits), 2)
            };
        }
    }

    /// <summary>Aggregate summary for one version.</summary>
    public class VersionSummary
    {
        public string  Version        { get; set; }
        public int     Interactions   { get; set; }
        public long    TotalTokens    { get; set; }
        public decimal TotalUsdCost   { get; set; }
        public decimal TotalAiCredits { get; set; }
    }

    /// <summary>Overall summary across all versions.</summary>
    public class OverallSummary
    {
        public List<VersionSummary> VersionSummaries  { get; set; } = new();
        public int     TotalInteractions { get; set; }
        public long    TotalTokens       { get; set; }
        public decimal TotalUsdCost      { get; set; }
        public decimal TotalAiCredits    { get; set; }
    }
}
