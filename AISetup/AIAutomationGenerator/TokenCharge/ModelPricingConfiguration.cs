using System;
using System.Collections.Generic;

namespace AIAutomationGenerator.TokenCharge
{
    /// <summary>
    /// Per-model pricing configuration.
    /// Rates are stored as USD per 1,000,000 tokens (per-million pricing).
    ///
    /// Design: models are registered by name; the calculator looks up the
    /// right rates at call-time. Adding a new model requires only a new
    /// ModelPricing entry — no code changes to Calculator or Logger.
    ///
    /// 1 AI Credit = $0.01 USD (constant regardless of model).
    /// </summary>
    public class ModelPricingConfiguration
    {
        /// <summary>USD per 1 AI Credit (universal constant).</summary>
        public const decimal UsdPerAiCredit = 0.01m;

        private readonly Dictionary<string, ModelPricing> _pricing;

        public ModelPricingConfiguration()
        {
            _pricing = new Dictionary<string, ModelPricing>(StringComparer.OrdinalIgnoreCase);
            RegisterDefaults();
        }

        // ===== Registration =====

        /// <summary>Register or overwrite pricing for a model.</summary>
        public void Register(string modelName, ModelPricing pricing)
        {
            if (string.IsNullOrWhiteSpace(modelName))
                throw new ArgumentNullException(nameof(modelName));
            _pricing[modelName.Trim()] = pricing ?? throw new ArgumentNullException(nameof(pricing));
        }

        /// <summary>Retrieve pricing for a model. Returns null if not registered.</summary>
        public ModelPricing GetPricing(string modelName)
        {
            if (string.IsNullOrWhiteSpace(modelName)) return null;
            _pricing.TryGetValue(modelName.Trim(), out var p);
            return p;
        }

        public bool IsRegistered(string modelName) =>
            !string.IsNullOrWhiteSpace(modelName) && _pricing.ContainsKey(modelName.Trim());

        // ===== Built-in models =====

        private void RegisterDefaults()
        {
            // Claude Sonnet 4.6 — rates as of 2026-08
            Register("Claude Sonnet 4.6", new ModelPricing
            {
                ModelName            = "Claude Sonnet 4.6",
                Provider             = "Anthropic / GitHub Copilot",
                InputPerMillion      = 3.00m,
                CachedInputPerMillion = 0.30m,
                CacheWritePerMillion  = 3.75m,
                OutputPerMillion     = 15.00m,
                PricingDate          = "2026-08"
            });

            // Claude Haiku 3.5 — example rates (placeholder)
            Register("Claude Haiku 3.5", new ModelPricing
            {
                ModelName            = "Claude Haiku 3.5",
                Provider             = "Anthropic / GitHub Copilot",
                InputPerMillion      = 0.80m,
                CachedInputPerMillion = 0.08m,
                CacheWritePerMillion  = 1.00m,
                OutputPerMillion     = 4.00m,
                PricingDate          = "2026-08"
            });

            // GPT-4o — example rates (placeholder)
            Register("GPT-4o", new ModelPricing
            {
                ModelName            = "GPT-4o",
                Provider             = "OpenAI / GitHub Copilot",
                InputPerMillion      = 2.50m,
                CachedInputPerMillion = 1.25m,
                CacheWritePerMillion  = 0.00m,   // OpenAI charges input, not cache write
                OutputPerMillion     = 10.00m,
                PricingDate          = "2026-08"
            });

            // GPT-4o mini
            Register("GPT-4o mini", new ModelPricing
            {
                ModelName            = "GPT-4o mini",
                Provider             = "OpenAI / GitHub Copilot",
                InputPerMillion      = 0.15m,
                CachedInputPerMillion = 0.075m,
                CacheWritePerMillion  = 0.00m,
                OutputPerMillion     = 0.60m,
                PricingDate          = "2026-08"
            });

            // Gemini 1.5 Pro — example rates (placeholder)
            Register("Gemini 1.5 Pro", new ModelPricing
            {
                ModelName            = "Gemini 1.5 Pro",
                Provider             = "Google / GitHub Copilot",
                InputPerMillion      = 1.25m,
                CachedInputPerMillion = 0.3125m,
                CacheWritePerMillion  = 0.00m,
                OutputPerMillion     = 5.00m,
                PricingDate          = "2026-08"
            });
        }
    }

    /// <summary>
    /// Pricing rates for a single model.
    /// All rates are USD per 1,000,000 tokens.
    /// </summary>
    public class ModelPricing
    {
        public string  ModelName             { get; set; }
        public string  Provider              { get; set; }
        public string  PricingDate           { get; set; }

        /// <summary>USD per 1M input tokens (not cached).</summary>
        public decimal InputPerMillion       { get; set; }

        /// <summary>USD per 1M cached input tokens (prompt cache hit).</summary>
        public decimal CachedInputPerMillion { get; set; }

        /// <summary>USD per 1M tokens written to cache.</summary>
        public decimal CacheWritePerMillion  { get; set; }

        /// <summary>USD per 1M output tokens.</summary>
        public decimal OutputPerMillion      { get; set; }
    }
}
