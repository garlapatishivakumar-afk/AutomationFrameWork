using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace AIAutomationGenerator.TokenCharge
{
    /// <summary>
    /// Generates Excel-compatible CSV reports from TokenChargeLogger data.
    ///
    /// Two sheets are simulated as two CSV files:
    ///   TokenCharge_Interactions.csv  — per-interaction detail (Sheet 1)
    ///   TokenCharge_Summary.csv       — version-level summary   (Sheet 2)
    ///
    /// Note on .xlsx:
    ///   CSV is Excel-native (File → Open → CSV). For true .xlsx output
    ///   (multiple worksheets, formatting) add EPPlus NuGet package and
    ///   extend this class with an ExportXlsx() method. The underlying
    ///   data model (TokenChargeRecord) remains identical.
    ///
    /// Column order matches the user-defined layout:
    ///   Date | Version | Interaction | Category | Model
    ///   | Input Tokens | Cached Input | Cache Write | Output Tokens
    ///   | Total Tokens | USD Cost | AI Credits | Token Source | Notes
    /// </summary>
    public class TokenChargeReport
    {
        // ===== Interaction detail report =====

        /// <summary>
        /// Generate the per-interaction CSV (Sheet 1 equivalent).
        /// </summary>
        public string GenerateInteractionCsv(IEnumerable<TokenChargeRecord> records)
        {
            var sb = new StringBuilder();

            // Header row
            sb.AppendLine(CsvRow(
                "Date", "Version", "Interaction", "Category", "Model",
                "Input Tokens", "Cached Input", "Cache Write", "Output Tokens",
                "Total Tokens", "USD Cost", "AI Credits", "Token Source", "Notes"));

            foreach (var r in records)
            {
                sb.AppendLine(CsvRow(
                    r.Date.ToString("dd-MMM-yy"),
                    r.Version,
                    r.Interaction,
                    r.Category,
                    r.Model,
                    r.InputTokens.ToString(),
                    r.CachedInputTokens.ToString(),
                    r.CacheWriteTokens.ToString(),
                    r.OutputTokens.ToString(),
                    r.TotalTokens.ToString(),
                    r.UsdCost.ToString("F4"),
                    r.AiCredits.ToString("F2"),
                    r.TokenSource,
                    r.Notes ?? ""));
            }

            return sb.ToString();
        }

        // ===== Version summary report =====

        /// <summary>
        /// Generate the version-level summary CSV (Sheet 2 equivalent).
        /// </summary>
        public string GenerateSummaryCsv(OverallSummary summary)
        {
            var sb = new StringBuilder();

            // Header
            sb.AppendLine(CsvRow("Version", "Interactions", "Total Tokens", "USD Cost", "AI Credits"));

            foreach (var v in summary.VersionSummaries)
            {
                sb.AppendLine(CsvRow(
                    v.Version,
                    v.Interactions.ToString(),
                    v.TotalTokens.ToString(),
                    v.TotalUsdCost.ToString("F4"),
                    v.TotalAiCredits.ToString("F2")));
            }

            // Totals row
            sb.AppendLine(CsvRow(
                "TOTAL",
                summary.TotalInteractions.ToString(),
                summary.TotalTokens.ToString(),
                summary.TotalUsdCost.ToString("F4"),
                summary.TotalAiCredits.ToString("F2")));

            return sb.ToString();
        }

        // ===== File writing =====

        /// <summary>
        /// Write both CSVs to <paramref name="outputDirectory"/>.
        /// Creates the directory if it does not exist.
        /// Returns the paths of the files written.
        /// </summary>
        public (string InteractionFile, string SummaryFile) WriteFiles(
            IEnumerable<TokenChargeRecord> records,
            OverallSummary summary,
            string outputDirectory)
        {
            Directory.CreateDirectory(outputDirectory);

            var interactionPath = Path.Combine(outputDirectory, "TokenCharge_Interactions.csv");
            var summaryPath     = Path.Combine(outputDirectory, "TokenCharge_Summary.csv");

            File.WriteAllText(interactionPath, GenerateInteractionCsv(records), Encoding.UTF8);
            File.WriteAllText(summaryPath,     GenerateSummaryCsv(summary),     Encoding.UTF8);

            return (interactionPath, summaryPath);
        }

        // ===== Human-readable console summary =====

        /// <summary>
        /// Returns a formatted text block suitable for test output or console display.
        /// </summary>
        public string FormatSummaryText(OverallSummary summary)
        {
            var sb = new StringBuilder();
            sb.AppendLine("=== TOKEN CHARGE SUMMARY ===");
            sb.AppendLine();
            sb.AppendLine($"{"Version",-10} {"Interactions",14} {"Total Tokens",14} {"USD Cost",12} {"AI Credits",12}");
            sb.AppendLine(new string('-', 64));

            foreach (var v in summary.VersionSummaries)
            {
                sb.AppendLine($"{v.Version,-10} {v.Interactions,14} {v.TotalTokens,14} ${v.TotalUsdCost,10:F4} {v.TotalAiCredits,11:F2}");
            }

            sb.AppendLine(new string('-', 64));
            sb.AppendLine($"{"TOTAL",-10} {summary.TotalInteractions,14} {summary.TotalTokens,14} ${summary.TotalUsdCost,10:F4} {summary.TotalAiCredits,11:F2}");
            sb.AppendLine();
            sb.AppendLine($"Token pricing model: Claude Sonnet 4.6 — Input $3/1M, Output $15/1M");
            sb.AppendLine($"1 AI Credit = $0.01 USD");

            return sb.ToString();
        }

        // ===== CSV helpers =====

        private static string CsvRow(params string[] values) =>
            string.Join(",", values.Select(EscapeCsv));

        private static string EscapeCsv(string value)
        {
            if (string.IsNullOrEmpty(value)) return "";
            bool needsQuotes = value.Contains(',') || value.Contains('"') || value.Contains('\n');
            return needsQuotes ? $"\"{value.Replace("\"", "\"\"")}\"" : value;
        }
    }
}
