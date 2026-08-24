using System;

namespace AIAutomationGenerator.TokenCharge
{
    /// <summary>
    /// A single Agent interaction record.
    /// Stores RAW token counts separately from CALCULATED billing so that:
    ///   - Raw counts survive if pricing changes later.
    ///   - Costs can be recalculated without losing original data.
    ///
    /// Fields that Copilot Agent cannot expose programmatically are nullable
    /// and marked with a source flag so reports can show "MANUAL" or "MEASURED".
    /// </summary>
    public class TokenChargeRecord
    {
        // ===== Identity =====
        public string RecordId       { get; set; } = Guid.NewGuid().ToString("N")[..8];
        public DateTime Date         { get; set; } = DateTime.UtcNow;
        public string Version        { get; set; }      // e.g. "V5.0"
        public string Interaction    { get; set; }      // e.g. "Generate Login test"
        public string Category       { get; set; }      // e.g. "Generation", "Validation", "Analysis"
        public string Model          { get; set; }      // e.g. "Claude Sonnet 4.6"

        // ===== Raw token counts (actual measured values) =====

        /// <summary>Standard (non-cached) input tokens.</summary>
        public long InputTokens       { get; set; }

        /// <summary>Tokens served from prompt cache.</summary>
        public long CachedInputTokens { get; set; }

        /// <summary>Tokens written to prompt cache.</summary>
        public long CacheWriteTokens  { get; set; }

        /// <summary>Output tokens generated.</summary>
        public long OutputTokens      { get; set; }

        /// <summary>
        /// How token counts were obtained.
        /// "MEASURED"  — obtained from API response headers/body.
        /// "MANUAL"    — entered by human from Copilot usage export.
        /// "ESTIMATED" — approximate, clearly labelled.
        /// </summary>
        public string TokenSource     { get; set; } = "MANUAL";

        // ===== Computed totals (populated by TokenChargeCalculator) =====
        public long    TotalTokens    { get; set; }
        public decimal UsdCost        { get; set; }
        public decimal AiCredits      { get; set; }

        // ===== Optional context =====
        public string Notes           { get; set; }

        // ===== Derived convenience =====
        public long BillableInput => InputTokens + CacheWriteTokens; // not cached read
    }
}
