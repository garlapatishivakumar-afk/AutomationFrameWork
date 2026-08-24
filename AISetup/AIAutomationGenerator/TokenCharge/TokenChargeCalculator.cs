using System;

namespace AIAutomationGenerator.TokenCharge
{
    /// <summary>
    /// Calculates USD cost and AI Credits from raw token counts.
    ///
    /// Formula:
    ///   UsdCost = (InputTokens        × InputPerMillion
    ///            + CachedInputTokens  × CachedInputPerMillion
    ///            + CacheWriteTokens   × CacheWritePerMillion
    ///            + OutputTokens       × OutputPerMillion) / 1,000,000
    ///
    ///   AiCredits = UsdCost / UsdPerAiCredit    (1 Credit = $0.01)
    ///
    /// All arithmetic uses decimal to avoid floating-point rounding errors.
    /// Results are rounded to 6 decimal places for USD, 2 for AI Credits.
    /// </summary>
    public class TokenChargeCalculator
    {
        private readonly ModelPricingConfiguration _config;

        public TokenChargeCalculator(ModelPricingConfiguration config = null)
        {
            _config = config ?? new ModelPricingConfiguration();
        }

        // ===== Calculate and stamp a record =====

        /// <summary>
        /// Calculate cost for a record and fill TotalTokens, UsdCost, AiCredits in-place.
        /// Returns the same record for fluent use.
        /// Throws if model pricing is not registered.
        /// </summary>
        public TokenChargeRecord Calculate(TokenChargeRecord record)
        {
            if (record == null) throw new ArgumentNullException(nameof(record));

            var pricing = _config.GetPricing(record.Model);
            if (pricing == null)
                throw new InvalidOperationException(
                    $"No pricing registered for model '{record.Model}'. " +
                    "Register it in ModelPricingConfiguration first.");

            record.TotalTokens = record.InputTokens
                                + record.CachedInputTokens
                                + record.CacheWriteTokens
                                + record.OutputTokens;

            record.UsdCost   = CalculateUsd(record, pricing);
            record.AiCredits = CalculateCredits(record.UsdCost);

            return record;
        }

        // ===== Pure calculation (no side effects) =====

        public CalculationResult CalculateFromCounts(
            string modelName,
            long inputTokens,
            long cachedInputTokens,
            long cacheWriteTokens,
            long outputTokens)
        {
            var pricing = _config.GetPricing(modelName)
                ?? throw new InvalidOperationException($"No pricing for model '{modelName}'.");

            long totalTokens = inputTokens + cachedInputTokens + cacheWriteTokens + outputTokens;

            decimal usd = ((inputTokens       * pricing.InputPerMillion)
                         + (cachedInputTokens * pricing.CachedInputPerMillion)
                         + (cacheWriteTokens  * pricing.CacheWritePerMillion)
                         + (outputTokens      * pricing.OutputPerMillion))
                         / 1_000_000m;

            usd = Math.Round(usd, 6);
            decimal credits = CalculateCredits(usd);

            return new CalculationResult
            {
                ModelName         = modelName,
                InputTokens       = inputTokens,
                CachedInputTokens = cachedInputTokens,
                CacheWriteTokens  = cacheWriteTokens,
                OutputTokens      = outputTokens,
                TotalTokens       = totalTokens,
                UsdCost           = usd,
                AiCredits         = credits,
                InputCostUsd      = Math.Round(inputTokens       * pricing.InputPerMillion       / 1_000_000m, 6),
                CachedCostUsd     = Math.Round(cachedInputTokens * pricing.CachedInputPerMillion / 1_000_000m, 6),
                CacheWriteCostUsd = Math.Round(cacheWriteTokens  * pricing.CacheWritePerMillion  / 1_000_000m, 6),
                OutputCostUsd     = Math.Round(outputTokens      * pricing.OutputPerMillion      / 1_000_000m, 6)
            };
        }

        // ===== Helpers =====

        private static decimal CalculateUsd(TokenChargeRecord r, ModelPricing p) =>
            Math.Round(
                (r.InputTokens       * p.InputPerMillion
               + r.CachedInputTokens * p.CachedInputPerMillion
               + r.CacheWriteTokens  * p.CacheWritePerMillion
               + r.OutputTokens      * p.OutputPerMillion) / 1_000_000m,
                6);

        private static decimal CalculateCredits(decimal usd) =>
            Math.Round(usd / ModelPricingConfiguration.UsdPerAiCredit, 2);
    }

    /// <summary>Pure calculation result — no record mutations.</summary>
    public class CalculationResult
    {
        public string  ModelName         { get; init; }
        public long    InputTokens       { get; init; }
        public long    CachedInputTokens { get; init; }
        public long    CacheWriteTokens  { get; init; }
        public long    OutputTokens      { get; init; }
        public long    TotalTokens       { get; init; }
        public decimal UsdCost           { get; init; }
        public decimal AiCredits         { get; init; }

        // Cost breakdown
        public decimal InputCostUsd      { get; init; }
        public decimal CachedCostUsd     { get; init; }
        public decimal CacheWriteCostUsd { get; init; }
        public decimal OutputCostUsd     { get; init; }
    }
}
