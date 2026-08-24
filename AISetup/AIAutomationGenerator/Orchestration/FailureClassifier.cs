using System;
using System.Text.RegularExpressions;

namespace AIAutomationGenerator.Orchestration
{
    /// <summary>
    /// Classifies pipeline failures to determine whether they are:
    ///   - Safe to retry (deterministic, transient)
    ///   - Safe to auto-correct (existing AutoCorrector handles it)
    ///   - HUMAN_REVIEW_REQUIRED (ambiguous, risky, or unknown)
    ///
    /// DESIGN PRINCIPLE:
    ///   Classification is purely deterministic — pattern matching on error messages.
    ///   No AI, no guessing. When in doubt, the classification is HUMAN_REVIEW_REQUIRED.
    ///   This is the safe default.
    ///
    /// BOUNDARY:
    ///   This classifier NEVER modifies code or files.
    ///   It only advises whether the orchestrator may retry or must escalate.
    /// </summary>
    public class FailureClassifier
    {
        public FailureClassification Classify(string errorMessage)
        {
            if (string.IsNullOrWhiteSpace(errorMessage))
            {
                return new FailureClassification
                {
                    IsSafeToRetry   = false,
                    IsAutoFixable   = false,
                    Category        = FailureCategory.Unknown,
                    Reason          = "Empty error message — cannot classify safely.",
                    RequiresHuman   = true
                };
            }

            // ===== Transient / safe-to-retry patterns =====

            if (IsTransientBuildFailure(errorMessage))
            {
                return new FailureClassification
                {
                    IsSafeToRetry = true,
                    IsAutoFixable = false,
                    Category      = FailureCategory.TransientBuild,
                    Reason        = "Transient build issue (lock, temp-file, or race condition) — safe to retry."
                };
            }

            // ===== Deterministic auto-fixable errors =====

            if (IsMissingUsing(errorMessage))
            {
                return new FailureClassification
                {
                    IsSafeToRetry = true,
                    IsAutoFixable = true,
                    Category      = FailureCategory.MissingUsing,
                    Reason        = "Missing using directive — AutoCorrector can add it deterministically."
                };
            }

            if (IsNamespaceError(errorMessage))
            {
                return new FailureClassification
                {
                    IsSafeToRetry = true,
                    IsAutoFixable = true,
                    Category      = FailureCategory.NamespaceError,
                    Reason        = "Namespace mismatch — AutoCorrector can fix from file path deterministically."
                };
            }

            // ===== Clearly unsafe — production framework risk =====

            if (IsProductionFrameworkModification(errorMessage))
            {
                return new FailureClassification
                {
                    IsSafeToRetry = false,
                    IsAutoFixable = false,
                    Category      = FailureCategory.ProductionFrameworkRisk,
                    Reason        = "Detected potential production framework modification. HUMAN_REVIEW_REQUIRED.",
                    RequiresHuman = true
                };
            }

            // ===== Test regressions =====

            if (IsTestRegression(errorMessage))
            {
                return new FailureClassification
                {
                    IsSafeToRetry = false,
                    IsAutoFixable = false,
                    Category      = FailureCategory.TestRegression,
                    Reason        = "Existing tests regressed — HUMAN_REVIEW_REQUIRED before proceeding.",
                    RequiresHuman = true
                };
            }

            // ===== Logic/syntax errors — not safe to auto-fix =====

            if (IsLogicOrSyntaxError(errorMessage))
            {
                return new FailureClassification
                {
                    IsSafeToRetry = false,
                    IsAutoFixable = false,
                    Category      = FailureCategory.LogicOrSyntax,
                    Reason        = "Logic or syntax error in generated code — HUMAN_REVIEW_REQUIRED.",
                    RequiresHuman = true
                };
            }

            // ===== Default: unknown — safe default is HUMAN_REVIEW_REQUIRED =====

            return new FailureClassification
            {
                IsSafeToRetry = false,
                IsAutoFixable = false,
                Category      = FailureCategory.Unknown,
                Reason        = "Failure could not be classified deterministically — HUMAN_REVIEW_REQUIRED.",
                RequiresHuman = true
            };
        }

        // ===== Pattern helpers (all deterministic, no AI) =====

        private static bool IsTransientBuildFailure(string error) =>
            error.Contains("locked by another process", StringComparison.OrdinalIgnoreCase) ||
            error.Contains("The process cannot access the file", StringComparison.OrdinalIgnoreCase) ||
            error.Contains("MSBuild version", StringComparison.OrdinalIgnoreCase) ||
            Regex.IsMatch(error, @"HRESULT.*0x80070020", RegexOptions.IgnoreCase);

        private static bool IsMissingUsing(string error) =>
            error.Contains("could not be found", StringComparison.OrdinalIgnoreCase) ||
            error.Contains("The type or namespace name", StringComparison.OrdinalIgnoreCase) ||
            error.Contains("are you missing a using directive", StringComparison.OrdinalIgnoreCase) ||
            Regex.IsMatch(error, @"CS0246|CS0234", RegexOptions.IgnoreCase);

        private static bool IsNamespaceError(string error) =>
            error.Contains("namespace", StringComparison.OrdinalIgnoreCase) &&
            (error.Contains("does not exist", StringComparison.OrdinalIgnoreCase) ||
             error.Contains("not found", StringComparison.OrdinalIgnoreCase));

        private static bool IsProductionFrameworkModification(string error) =>
            error.Contains("AutomationFrameWork", StringComparison.OrdinalIgnoreCase) &&
            (error.Contains("modified", StringComparison.OrdinalIgnoreCase) ||
             error.Contains("overwritten", StringComparison.OrdinalIgnoreCase) ||
             error.Contains("deleted", StringComparison.OrdinalIgnoreCase));

        private static bool IsTestRegression(string error) =>
            error.Contains("regression", StringComparison.OrdinalIgnoreCase) ||
            (error.Contains("Failed:", StringComparison.OrdinalIgnoreCase) &&
             error.Contains("previously passing", StringComparison.OrdinalIgnoreCase));

        private static bool IsLogicOrSyntaxError(string error) =>
            Regex.IsMatch(error, @"CS\d{4}", RegexOptions.IgnoreCase) && // any C# compiler error
            !IsMissingUsing(error) &&
            !IsNamespaceError(error);
    }

    /// <summary>Result of classifying a failure.</summary>
    public class FailureClassification
    {
        public FailureCategory Category     { get; init; }
        public bool IsSafeToRetry          { get; init; }
        public bool IsAutoFixable          { get; init; }
        public bool RequiresHuman          { get; init; }
        public string Reason               { get; init; }
    }

    public enum FailureCategory
    {
        Unknown,
        TransientBuild,
        MissingUsing,
        NamespaceError,
        LogicOrSyntax,
        TestRegression,
        ProductionFrameworkRisk
    }
}
