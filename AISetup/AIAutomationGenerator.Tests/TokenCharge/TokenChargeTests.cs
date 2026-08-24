using System;
using System.IO;
using System.Linq;
using Xunit;
using AIAutomationGenerator.TokenCharge;

namespace AIAutomationGenerator.Tests.TokenCharge
{
    /// <summary>
    /// Tests for the Token Charge Count infrastructure.
    ///
    /// Validates:
    ///   ModelPricingConfiguration — registration, lookup, defaults
    ///   TokenChargeCalculator — USD and AI Credit arithmetic (Claude Sonnet 4.6)
    ///   TokenChargeLogger — log, import, query, aggregate
    ///   TokenChargeReport — CSV generation, file writing, text formatting
    ///   Cross-cutting — raw tokens preserved, 1 Credit = $0.01
    /// </summary>
    public class TokenChargeTests
    {
        // ===========================
        // ModelPricingConfiguration
        // ===========================

        [Fact]
        public void Pricing_ClaudeSonnet46_IsRegisteredByDefault()
        {
            var config = new ModelPricingConfiguration();
            Assert.True(config.IsRegistered("Claude Sonnet 4.6"));
        }

        [Fact]
        public void Pricing_ClaudeSonnet46_HasCorrectRates()
        {
            var config   = new ModelPricingConfiguration();
            var pricing  = config.GetPricing("Claude Sonnet 4.6");

            Assert.NotNull(pricing);
            Assert.Equal(3.00m,  pricing.InputPerMillion);
            Assert.Equal(0.30m,  pricing.CachedInputPerMillion);
            Assert.Equal(3.75m,  pricing.CacheWritePerMillion);
            Assert.Equal(15.00m, pricing.OutputPerMillion);
        }

        [Fact]
        public void Pricing_UnknownModel_ReturnsNull()
        {
            var config  = new ModelPricingConfiguration();
            var pricing = config.GetPricing("Model Does Not Exist");
            Assert.Null(pricing);
        }

        [Fact]
        public void Pricing_Register_CustomModel_IsLookedUpByName()
        {
            var config = new ModelPricingConfiguration();
            config.Register("TestModel", new ModelPricing
            {
                ModelName       = "TestModel",
                InputPerMillion = 1.00m,
                OutputPerMillion = 5.00m
            });

            Assert.True(config.IsRegistered("TestModel"));
            Assert.Equal(1.00m, config.GetPricing("TestModel").InputPerMillion);
        }

        [Fact]
        public void Pricing_Register_IsCaseInsensitive()
        {
            var config = new ModelPricingConfiguration();
            Assert.True(config.IsRegistered("claude sonnet 4.6"));
            Assert.True(config.IsRegistered("CLAUDE SONNET 4.6"));
        }

        [Fact]
        public void Pricing_UsdPerAiCredit_Is001()
        {
            Assert.Equal(0.01m, ModelPricingConfiguration.UsdPerAiCredit);
        }

        // ===========================
        // TokenChargeCalculator
        // ===========================

        [Fact]
        public void Calculator_ClaudeSonnet46_InputOnly_CorrectUsd()
        {
            // 1,000,000 input tokens × $3.00/M = $3.00
            var calc = new TokenChargeCalculator();
            var result = calc.CalculateFromCounts("Claude Sonnet 4.6",
                inputTokens: 1_000_000, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0);

            Assert.Equal(3.00m, result.UsdCost);
        }

        [Fact]
        public void Calculator_ClaudeSonnet46_OutputOnly_CorrectUsd()
        {
            // 1,000,000 output tokens × $15.00/M = $15.00
            var calc = new TokenChargeCalculator();
            var result = calc.CalculateFromCounts("Claude Sonnet 4.6",
                inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 1_000_000);

            Assert.Equal(15.00m, result.UsdCost);
        }

        [Fact]
        public void Calculator_ClaudeSonnet46_UserExample_20kInput_8kOutput()
        {
            // From user spec: 20,000 input + 8,000 output
            // Input  = 20,000 × 3.00  / 1,000,000 = $0.06
            // Output =  8,000 × 15.00 / 1,000,000 = $0.12
            // Total  = $0.18 → 18 AI Credits
            var calc = new TokenChargeCalculator();
            var result = calc.CalculateFromCounts("Claude Sonnet 4.6",
                inputTokens: 20_000, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 8_000);

            Assert.Equal(0.18m, result.UsdCost);
            Assert.Equal(18m,   result.AiCredits);
        }

        [Fact]
        public void Calculator_CachedInputIsCharged_AtLowerRate()
        {
            // 1M cached input × $0.30/M = $0.30
            var calc = new TokenChargeCalculator();
            var result = calc.CalculateFromCounts("Claude Sonnet 4.6",
                inputTokens: 0, cachedInputTokens: 1_000_000, cacheWriteTokens: 0, outputTokens: 0);

            Assert.Equal(0.30m, result.UsdCost);
            Assert.True(result.UsdCost < 3.00m); // cheaper than non-cached
        }

        [Fact]
        public void Calculator_CacheWriteIsCharged()
        {
            // 1M cache write × $3.75/M = $3.75
            var calc = new TokenChargeCalculator();
            var result = calc.CalculateFromCounts("Claude Sonnet 4.6",
                inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 1_000_000, outputTokens: 0);

            Assert.Equal(3.75m, result.UsdCost);
        }

        [Fact]
        public void Calculator_AiCredits_EqualUsdDividedByHundredth()
        {
            // 1 Credit = $0.01, so Credits = USD × 100
            var calc = new TokenChargeCalculator();
            var result = calc.CalculateFromCounts("Claude Sonnet 4.6",
                inputTokens: 10_000, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 10_000);

            Assert.Equal(result.UsdCost / 0.01m, result.AiCredits);
        }

        [Fact]
        public void Calculator_TotalTokens_SumOfAll()
        {
            var calc = new TokenChargeCalculator();
            var result = calc.CalculateFromCounts("Claude Sonnet 4.6",
                inputTokens: 100, cachedInputTokens: 200, cacheWriteTokens: 300, outputTokens: 400);

            Assert.Equal(1000, result.TotalTokens);
        }

        [Fact]
        public void Calculator_UnknownModel_Throws()
        {
            var calc = new TokenChargeCalculator();
            Assert.Throws<InvalidOperationException>(() =>
                calc.CalculateFromCounts("Unknown Model", 100, 0, 0, 50));
        }

        // ===========================
        // TokenChargeLogger
        // ===========================

        [Fact]
        public void Logger_Log_AddsRecord_WithCalculatedCost()
        {
            var logger = new TokenChargeLogger { DefaultVersion = "V5.0" };
            var record = logger.Log("Generate test", inputTokens: 20_000, outputTokens: 8_000);

            Assert.Equal(1, logger.RecordCount);
            Assert.Equal(0.18m, record.UsdCost);
            Assert.Equal(18m,   record.AiCredits);
        }

        [Fact]
        public void Logger_Log_PreservesRawTokenCounts()
        {
            var logger = new TokenChargeLogger();
            var record = logger.Log("Test",
                inputTokens: 1000, outputTokens: 500,
                cachedInputTokens: 200, cacheWriteTokens: 300);

            Assert.Equal(1000, record.InputTokens);
            Assert.Equal(500,  record.OutputTokens);
            Assert.Equal(200,  record.CachedInputTokens);
            Assert.Equal(300,  record.CacheWriteTokens);
        }

        [Fact]
        public void Logger_Log_SetsVersionFromDefault()
        {
            var logger = new TokenChargeLogger { DefaultVersion = "V4.0" };
            var record = logger.Log("Test", 100, 50);
            Assert.Equal("V4.0", record.Version);
        }

        [Fact]
        public void Logger_Log_SetsExplicitVersionOverDefault()
        {
            var logger = new TokenChargeLogger { DefaultVersion = "V5.0" };
            var record = logger.Log("Test", 100, 50, version: "V3.0");
            Assert.Equal("V3.0", record.Version);
        }

        [Fact]
        public void Logger_Import_CalculatesCostOnImport()
        {
            var logger = new TokenChargeLogger();
            var imported = new TokenChargeRecord
            {
                Version      = "V4.0",
                Interaction  = "Validate build",
                Model        = "Claude Sonnet 4.6",
                InputTokens  = 10_000,
                OutputTokens = 5_000,
                TokenSource  = "MANUAL"
            };

            var record = logger.Import(imported);

            Assert.True(record.UsdCost > 0);
            Assert.True(record.AiCredits > 0);
        }

        [Fact]
        public void Logger_ByVersion_FiltersCorrectly()
        {
            var logger = new TokenChargeLogger();
            logger.Log("A", 100, 50, version: "V4.0");
            logger.Log("B", 100, 50, version: "V5.0");
            logger.Log("C", 100, 50, version: "V5.0");

            Assert.Single(logger.ByVersion("V4.0"));
            Assert.Equal(2, logger.ByVersion("V5.0").Count());
        }

        [Fact]
        public void Logger_SummariseVersion_AggregatesTotals()
        {
            var logger = new TokenChargeLogger { DefaultVersion = "V5.0" };
            logger.Log("A", 10_000, 4_000);   // $0.09
            logger.Log("B", 10_000, 4_000);   // $0.09

            var summary = logger.SummariseVersion("V5.0");

            Assert.Equal(2, summary.Interactions);
            Assert.Equal(0.18m, summary.TotalUsdCost);
            Assert.Equal(18m,   summary.TotalAiCredits);
        }

        [Fact]
        public void Logger_SummariseAll_ContainsAllVersions()
        {
            var logger = new TokenChargeLogger();
            logger.Log("A", 10_000, 5_000, version: "V4.0");
            logger.Log("B", 10_000, 5_000, version: "V5.0");

            var summary = logger.SummariseAll();

            Assert.Equal(2, summary.TotalInteractions);
            Assert.Equal(2, summary.VersionSummaries.Count);
            Assert.Contains(summary.VersionSummaries, v => v.Version == "V4.0");
            Assert.Contains(summary.VersionSummaries, v => v.Version == "V5.0");
        }

        // ===========================
        // TokenChargeReport
        // ===========================

        [Fact]
        public void Report_InteractionCsv_ContainsHeaderRow()
        {
            var report = new TokenChargeReport();
            var csv    = report.GenerateInteractionCsv(Array.Empty<TokenChargeRecord>());

            Assert.Contains("Date", csv);
            Assert.Contains("Input Tokens", csv);
            Assert.Contains("USD Cost", csv);
            Assert.Contains("AI Credits", csv);
        }

        [Fact]
        public void Report_InteractionCsv_ContainsRecordData()
        {
            var logger = new TokenChargeLogger { DefaultVersion = "V5.0" };
            logger.Log("Generate Login test", 20_000, 8_000, version: "V5.0");

            var report = new TokenChargeReport();
            var csv    = report.GenerateInteractionCsv(logger.AllRecords);

            Assert.Contains("Generate Login test", csv);
            Assert.Contains("V5.0", csv);
            Assert.Contains("0.18", csv);
            Assert.Contains("18", csv);
        }

        [Fact]
        public void Report_SummaryCsv_ContainsVersionRow()
        {
            var logger = new TokenChargeLogger { DefaultVersion = "V5.0" };
            logger.Log("Test", 20_000, 8_000);

            var report  = new TokenChargeReport();
            var summary = logger.SummariseAll();
            var csv     = report.GenerateSummaryCsv(summary);

            Assert.Contains("V5.0", csv);
            Assert.Contains("TOTAL", csv);
        }

        [Fact]
        public void Report_WriteFiles_CreatesBothCsvFiles()
        {
            var logger = new TokenChargeLogger { DefaultVersion = "V5.0" };
            logger.Log("Test", 20_000, 8_000);

            var report   = new TokenChargeReport();
            var dir      = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
            var summary  = logger.SummariseAll();

            try
            {
                var (interactions, summaryCsv) = report.WriteFiles(logger.AllRecords, summary, dir);

                Assert.True(File.Exists(interactions));
                Assert.True(File.Exists(summaryCsv));
                Assert.True(new FileInfo(interactions).Length > 0);
                Assert.True(new FileInfo(summaryCsv).Length > 0);
            }
            finally
            {
                if (Directory.Exists(dir)) Directory.Delete(dir, true);
            }
        }

        [Fact]
        public void Report_FormatSummaryText_ContainsExpectedLines()
        {
            var logger = new TokenChargeLogger { DefaultVersion = "V5.0" };
            logger.Log("Test", 20_000, 8_000);

            var report  = new TokenChargeReport();
            var text    = report.FormatSummaryText(logger.SummariseAll());

            Assert.Contains("TOKEN CHARGE SUMMARY", text);
            Assert.Contains("V5.0", text);
            Assert.Contains("$", text);
            Assert.Contains("AI Credits", text);
        }

        // ===========================
        // Cross-cutting invariants
        // ===========================

        [Fact]
        public void Invariant_RawTokenCountsNeverModifiedByCalculator()
        {
            // Calculator must not change the original token fields
            var logger = new TokenChargeLogger();
            var record = logger.Log("Test", inputTokens: 12_345, outputTokens: 6_789);

            Assert.Equal(12_345, record.InputTokens);
            Assert.Equal(6_789,  record.OutputTokens);
        }

        [Fact]
        public void Invariant_OneAiCreditEqualsOneCentUsd()
        {
            Assert.Equal(0.01m, ModelPricingConfiguration.UsdPerAiCredit);

            var calc = new TokenChargeCalculator();
            var result = calc.CalculateFromCounts("Claude Sonnet 4.6",
                inputTokens: 100_000, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0);

            // $0.30 → 30 AI Credits
            Assert.Equal(result.UsdCost * 100, result.AiCredits);
        }

        [Fact]
        public void Invariant_TokenSourceDefaultIsManual_OnNewRecord()
        {
            var record = new TokenChargeRecord();
            Assert.Equal("MANUAL", record.TokenSource);
        }
    }
}
