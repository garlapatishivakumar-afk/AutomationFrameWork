using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using AIAutomationGenerator.Planning;
using AIAutomationGenerator.Orchestration;
using AIAutomationGenerator.Safety;

namespace AIAutomationGenerator.Implementation
{
    /// <summary>
    /// V7.0 P2 — Executes an EngineeringPlan with controlled file changes,
    /// bounded self-correction, rollback on worsening, and HUMAN_REVIEW_REQUIRED
    /// escalation when correction is not safe.
    ///
    /// RULES:
    ///   - Only acts on EngineeringPlan.PlannedFileChanges.
    ///   - Never modifies protected framework files.
    ///   - MaxRetries is bounded (default 2).
    ///   - Every retry has a recorded reason.
    ///   - Never invents selectors, never weakens assertions, never deletes tests.
    ///   - Rollback when a correction makes things worse.
    ///   - FrameworkModified must remain false.
    /// </summary>
    public class ImplementationEngine
    {
        public const int DefaultMaxRetries = 2;
        private readonly FailureClassifier _classifier;
        private readonly ProtectedFilePolicy _protectedFilePolicy;
        private readonly Dictionary<AIAutomationGenerator.Orchestration.FailureCategory, IFailureCorrectionStrategy> _strategies;

        public ImplementationEngine(ProtectedFilePolicy? protectedFilePolicy = null)
        {
            _classifier = new FailureClassifier();
            _protectedFilePolicy = protectedFilePolicy ?? new ProtectedFilePolicy();
            _strategies = new Dictionary<AIAutomationGenerator.Orchestration.FailureCategory, IFailureCorrectionStrategy>
            {
                [AIAutomationGenerator.Orchestration.FailureCategory.MissingUsing] = new MissingUsingCorrectionStrategy(),
                [AIAutomationGenerator.Orchestration.FailureCategory.NamespaceError] = new NamespaceErrorCorrectionStrategy()
            };
        }

        /// <summary>
        /// Execute a plan. Returns an execution record with full audit trail.
        /// Does NOT write real files in this version — records what WOULD happen.
        /// Actual file I/O is gated behind a live framework environment.
        /// </summary>
        public ImplementationExecutionRecord Execute(
            EngineeringPlan plan,
            int maxRetries = DefaultMaxRetries,
            bool applyFileSystemChanges = false)
        {
            if (plan == null) throw new ArgumentNullException(nameof(plan));

            var record = new ImplementationExecutionRecord
            {
                PlanId    = plan.PlanId,
                StartedAt = DateTime.UtcNow
            };

            // Gate 1: plan must be Ready
            if (plan.Status == PlanStatus.HumanReviewRequired)
            {
                record.FinalStatus         = ImplementationStatus.HumanReviewRequired;
                record.HumanReviewRequired = "Plan requires human review before implementation.";
                record.HumanReviewNotes.AddRange(plan.HumanReviewReasons);
                record.CompletedAt         = DateTime.UtcNow;
                return record;
            }

            var planned = plan.PlannedFileChanges ?? new List<FilePlan>();
            var allowedPaths = planned
                .Where(p => !string.IsNullOrWhiteSpace(p.FilePath))
                .Select(p => NormalizeFullPath(p.FilePath))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var transactions = CaptureState(planned);
            var changedPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            foreach (var filePlan in planned)
            {
                var changeRecord = ProcessFilePlan(
                    filePlan,
                    plan,
                    record,
                    maxRetries,
                    applyFileSystemChanges,
                    allowedPaths,
                    transactions,
                    changedPaths);

                record.Changes.Add(changeRecord);

                if (changeRecord.Status == ChangeStatus.HumanReviewRequired)
                {
                    var restored = RestoreFiles(changedPaths, transactions, record);
                    if (!restored)
                    {
                        record.FinalStatus = ImplementationStatus.Failed;
                    }
                    record.HumanReviewRequired = "Change execution stopped due to safety validation.";
                    break;
                }
            }

            if (applyFileSystemChanges && changedPaths.Count > 0)
            {
                var unexpected = DetectUnexpectedChanges(transactions, allowedPaths);
                if (unexpected.Any())
                {
                    record.HumanReviewNotes.Add($"Unexpected file changes detected: {string.Join(", ", unexpected)}");
                    record.HumanReviewRequired = "Unexpected file modification detected.";
                    RestoreFiles(changedPaths, transactions, record);
                    record.FinalStatus = ImplementationStatus.HumanReviewRequired;
                }
            }

            // REUSE decisions: no file change, just record
            foreach (var decision in plan.Decisions.Where(d =>
                d.Decision == EngineeringDecisionType.Reuse))
            {
                record.Changes.Add(new ChangeRecord
                {
                    FilePath       = decision.SourcePath ?? decision.Component,
                    ChangeType     = ChangeType.Reuse,
                    DecisionSource = decision.ActionDescription,
                    Evidence       = decision.Evidence.FirstOrDefault()?.EvidenceText,
                    Reason         = decision.Reason,
                    Risk           = ChangeRisk.Low,
                    Status         = ChangeStatus.Skipped  // Reuse = no change
                });
            }

            // HumanReview decisions: halt, escalate
            var hrDecisions = plan.Decisions
                .Where(d => d.Decision == EngineeringDecisionType.HumanReviewRequired)
                .ToList();
            if (hrDecisions.Any() || record.Changes.Any(c => c.Status == ChangeStatus.HumanReviewRequired))
            {
                record.FinalStatus = ImplementationStatus.HumanReviewRequired;
                record.HumanReviewNotes.AddRange(hrDecisions.Select(d => d.HumanReviewNote)
                    .Where(n => !string.IsNullOrEmpty(n)));
            }
            else
            {
                record.FinalStatus = record.Changes.All(c =>
                    c.Status == ChangeStatus.Applied || c.Status == ChangeStatus.Skipped)
                    ? ImplementationStatus.Success
                    : ImplementationStatus.PartialSuccess;
            }

            // Ensure framework stays protected
            record.FrameworkModified = false;
            record.CompletedAt       = DateTime.UtcNow;
            return record;
        }

        // ===== Per-file processing with bounded self-correction =====

        private ChangeRecord ProcessFilePlan(
            FilePlan filePlan,
            EngineeringPlan plan,
            ImplementationExecutionRecord record,
            int maxRetries,
            bool applyFileSystemChanges,
            HashSet<string> allowedPaths,
            Dictionary<string, FileTransactionState> transactions,
            HashSet<string> changedPaths)
        {
            if (filePlan == null || string.IsNullOrWhiteSpace(filePlan.FilePath))
            {
                return new ChangeRecord
                {
                    FilePath = filePlan?.FilePath ?? string.Empty,
                    ChangeType = ChangeType.Create,
                    DecisionSource = filePlan?.Reason,
                    Evidence = filePlan?.Evidence,
                    Reason = "Invalid file plan.",
                    Risk = ChangeRisk.High,
                    Status = ChangeStatus.HumanReviewRequired
                };
            }

            var normalizedPath = NormalizeFullPath(filePlan.FilePath);
            var isProtected = filePlan.IsProtected || _protectedFilePolicy.IsProtected(filePlan.FilePath);
            if (isProtected)
            {
                return new ChangeRecord
                {
                    FilePath       = filePlan.FilePath,
                    ChangeType     = filePlan.ModificationType == FileModificationType.Extend
                        ? ChangeType.Extend
                        : ChangeType.Create,
                    DecisionSource = filePlan.Reason,
                    Evidence       = filePlan.Evidence,
                    Reason         = "Protected file",
                    Risk           = ChangeRisk.Protected,
                    Status         = ChangeStatus.HumanReviewRequired
                };
            }

            if (!allowedPaths.Contains(normalizedPath))
            {
                return new ChangeRecord
                {
                    FilePath = filePlan.FilePath,
                    ChangeType = ChangeType.Create,
                    DecisionSource = filePlan.Reason,
                    Evidence = filePlan.Evidence,
                    Reason = "Unauthorized file path outside planned allowlist.",
                    Risk = ChangeRisk.High,
                    Status = ChangeStatus.HumanReviewRequired
                };
            }

            var changeType = filePlan.ModificationType switch
            {
                FileModificationType.Create => ChangeType.Create,
                FileModificationType.Extend => ChangeType.Extend,
                _                           => ChangeType.Reuse
            };

            if (changeType == ChangeType.Reuse)
            {
                return new ChangeRecord
                {
                    FilePath = filePlan.FilePath,
                    ChangeType = ChangeType.Reuse,
                    DecisionSource = filePlan.Reason,
                    Evidence = filePlan.Evidence,
                    Reason = filePlan.Reason,
                    Risk = ChangeRisk.Low,
                    Status = ChangeStatus.Skipped
                };
            }

            if (!applyFileSystemChanges)
            {
                return new ChangeRecord
                {
                    FilePath       = filePlan.FilePath,
                    ChangeType     = changeType,
                    DecisionSource = filePlan.Reason,
                    Evidence       = filePlan.Evidence,
                    Reason         = filePlan.Reason,
                    Risk           = ChangeRisk.Low,
                    Status         = ChangeStatus.Applied
                };
            }

            if (string.IsNullOrWhiteSpace(filePlan.PlannedContent))
            {
                return new ChangeRecord
                {
                    FilePath = filePlan.FilePath,
                    ChangeType = changeType,
                    DecisionSource = filePlan.Reason,
                    Evidence = filePlan.Evidence,
                    Reason = "Missing planned content for real file modification.",
                    Risk = ChangeRisk.High,
                    Status = ChangeStatus.HumanReviewRequired
                };
            }

            try
            {
                if (!transactions.TryGetValue(normalizedPath, out var state))
                {
                    return new ChangeRecord
                    {
                        FilePath = filePlan.FilePath,
                        ChangeType = changeType,
                        DecisionSource = filePlan.Reason,
                        Evidence = filePlan.Evidence,
                        Reason = "No transaction state available for target file.",
                        Risk = ChangeRisk.High,
                        Status = ChangeStatus.HumanReviewRequired
                    };
                }

                var beforeHash = state.BeforeHash;
                ApplyFileChange(state.AbsolutePath, changeType, filePlan.PlannedContent);

                if (!File.Exists(state.AbsolutePath))
                {
                    return new ChangeRecord
                    {
                        FilePath = filePlan.FilePath,
                        ChangeType = changeType,
                        DecisionSource = filePlan.Reason,
                        Evidence = filePlan.Evidence,
                        Reason = "File write verification failed.",
                        Risk = ChangeRisk.High,
                        Status = ChangeStatus.HumanReviewRequired
                    };
                }

                var bytes = File.ReadAllBytes(state.AbsolutePath);
                var afterHash = ComputeHash(bytes);
                if (string.Equals(beforeHash, afterHash, StringComparison.OrdinalIgnoreCase))
                {
                    return new ChangeRecord
                    {
                        FilePath = filePlan.FilePath,
                        ChangeType = changeType,
                        DecisionSource = filePlan.Reason,
                        Evidence = filePlan.Evidence,
                        Reason = "File content did not change after apply.",
                        Risk = ChangeRisk.Medium,
                        Status = ChangeStatus.HumanReviewRequired,
                        BeforeHash = beforeHash,
                        AfterHash = afterHash
                    };
                }

                changedPaths.Add(normalizedPath);

                return new ChangeRecord
                {
                    FilePath       = filePlan.FilePath,
                    ChangeType     = changeType,
                    DecisionSource = filePlan.Reason,
                    Evidence       = filePlan.Evidence,
                    Reason         = filePlan.Reason,
                    Risk           = ChangeRisk.Low,
                    Status         = ChangeStatus.Applied,
                    BeforeHash     = beforeHash,
                    AfterHash      = afterHash
                };
            }
            catch (Exception ex)
            {
                return new ChangeRecord
                {
                    FilePath = filePlan.FilePath,
                    ChangeType = changeType,
                    DecisionSource = filePlan.Reason,
                    Evidence = filePlan.Evidence,
                    Reason = "File application failed.",
                    Risk = ChangeRisk.High,
                    Status = ChangeStatus.HumanReviewRequired,
                    ErrorMessage = ex.Message
                };
            }
        }

        private static Dictionary<string, FileTransactionState> CaptureState(IEnumerable<FilePlan> plans)
        {
            var states = new Dictionary<string, FileTransactionState>(StringComparer.OrdinalIgnoreCase);
            foreach (var plan in plans)
            {
                if (string.IsNullOrWhiteSpace(plan.FilePath))
                {
                    continue;
                }

                var absolute = NormalizeFullPath(plan.FilePath);
                if (states.ContainsKey(absolute))
                {
                    continue;
                }

                var exists = File.Exists(absolute);
                var bytes = exists ? File.ReadAllBytes(absolute) : null;
                states[absolute] = new FileTransactionState
                {
                    AbsolutePath = absolute,
                    ExistedBefore = exists,
                    BeforeBytes = bytes,
                    BeforeLength = bytes?.LongLength ?? 0,
                    BeforeHash = bytes == null ? null : ComputeHash(bytes)
                };
            }

            return states;
        }

        private static void ApplyFileChange(string absolutePath, ChangeType changeType, string content)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(absolutePath) ?? string.Empty);

            if (changeType == ChangeType.Create)
            {
                File.WriteAllText(absolutePath, content, Encoding.UTF8);
                return;
            }

            var original = File.Exists(absolutePath)
                ? File.ReadAllText(absolutePath)
                : string.Empty;

            if (!IsBraceBalanced(original))
            {
                throw new InvalidOperationException("Unsafe file structure detected (brace imbalance).");
            }

            var extended = original + Environment.NewLine + content.TrimEnd() + Environment.NewLine;
            File.WriteAllText(absolutePath, extended, Encoding.UTF8);
        }

        private static bool RestoreFiles(
            IEnumerable<string> changedPaths,
            Dictionary<string, FileTransactionState> transactions,
            ImplementationExecutionRecord record)
        {
            var allOk = true;
            foreach (var normalized in changedPaths)
            {
                if (!transactions.TryGetValue(normalized, out var state))
                {
                    allOk = false;
                    continue;
                }

                try
                {
                    if (!state.ExistedBefore)
                    {
                        if (File.Exists(state.AbsolutePath))
                        {
                            File.Delete(state.AbsolutePath);
                        }
                    }
                    else
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(state.AbsolutePath) ?? string.Empty);
                        File.WriteAllBytes(state.AbsolutePath, state.BeforeBytes ?? Array.Empty<byte>());
                    }

                    var restoredHash = File.Exists(state.AbsolutePath)
                        ? ComputeHash(File.ReadAllBytes(state.AbsolutePath))
                        : null;

                    if (!string.Equals(restoredHash, state.BeforeHash, StringComparison.OrdinalIgnoreCase))
                    {
                        allOk = false;
                        record.HumanReviewNotes.Add($"Rollback hash mismatch for {state.AbsolutePath}");
                    }
                }
                catch (Exception ex)
                {
                    allOk = false;
                    record.HumanReviewNotes.Add($"Rollback failed for {state.AbsolutePath}: {ex.Message}");
                }
            }

            return allOk;
        }

        private static List<string> DetectUnexpectedChanges(
            Dictionary<string, FileTransactionState> transactions,
            HashSet<string> allowed)
        {
            var changed = new List<string>();
            foreach (var kvp in transactions)
            {
                var state = kvp.Value;
                var existsNow = File.Exists(state.AbsolutePath);

                if (!state.ExistedBefore && existsNow)
                {
                    if (!allowed.Contains(kvp.Key))
                    {
                        changed.Add(state.AbsolutePath);
                    }
                    continue;
                }

                if (state.ExistedBefore && existsNow)
                {
                    var nowHash = ComputeHash(File.ReadAllBytes(state.AbsolutePath));
                    if (!string.Equals(state.BeforeHash, nowHash, StringComparison.OrdinalIgnoreCase)
                        && !allowed.Contains(kvp.Key))
                    {
                        changed.Add(state.AbsolutePath);
                    }
                }
            }

            return changed;
        }

        private static string NormalizeFullPath(string path)
        {
            var full = Path.GetFullPath(path);
            return ProtectedFilePolicy.Normalize(full);
        }

        private static string ComputeHash(byte[] bytes)
        {
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(bytes));
        }

        private static bool IsBraceBalanced(string source)
        {
            var balance = 0;
            foreach (var ch in source)
            {
                if (ch == '{') balance++;
                if (ch == '}') balance--;
                if (balance < 0) return false;
            }
            return balance == 0;
        }

        // ===== Self-healing (failure correction) =====

        /// <summary>
        /// Attempt to correct a classified build failure.
        /// Only safe deterministic corrections are applied.
        /// Increments retry count; stops at maxRetries.
        /// </summary>
        public SelfHealResult TryCorrect(
            string errorMessage,
            ImplementationExecutionRecord record,
            int currentAttempt,
            int maxRetries)
        {
            if (currentAttempt >= maxRetries)
            {
                record.HumanReviewNotes.Add(
                    $"Retry limit ({maxRetries}) reached. Last error: {errorMessage}");
                return new SelfHealResult
                {
                    Succeeded         = false,
                    Reason            = $"Retry limit {maxRetries} reached.",
                    RequiresHuman     = true,
                    AttemptNumber     = currentAttempt
                };
            }

            var classification = _classifier.Classify(errorMessage);
            record.CorrectionsAttempted++;

            if (!classification.IsSafeToRetry)
            {
                record.HumanReviewNotes.Add(
                    $"Correction unsafe: {classification.Reason}. Error: {errorMessage}");
                return new SelfHealResult
                {
                    Succeeded     = false,
                    Reason        = classification.Reason,
                    RequiresHuman = true,
                    AttemptNumber = currentAttempt
                };
            }

            if (!_strategies.TryGetValue(classification.Category, out var strategy))
            {
                strategy = new UnsupportedFailureCorrectionStrategy(classification.Category);
            }

            var strategyResult = strategy.Apply(errorMessage, currentAttempt);
            if (strategyResult.Succeeded)
            {
                record.CorrectionsSucceeded++;
            }

            return strategyResult;
        }

        /// <summary>
        /// Roll back a change. Records the rollback.
        /// </summary>
        public RollbackResult Rollback(string filePath, ImplementationExecutionRecord record)
        {
            record.Rollbacks++;
            record.Changes.Add(new ChangeRecord
            {
                FilePath   = filePath,
                ChangeType = ChangeType.Rollback,
                Reason     = "Rollback triggered — correction made result worse or failed.",
                Risk       = ChangeRisk.Low,
                Status     = ChangeStatus.RolledBack
            });
            return new RollbackResult { Succeeded = true, FilePath = filePath };
        }

        private sealed class FileTransactionState
        {
            public string AbsolutePath { get; init; } = string.Empty;
            public bool ExistedBefore { get; init; }
            public byte[]? BeforeBytes { get; init; }
            public string? BeforeHash { get; init; }
            public long BeforeLength { get; init; }
        }
    }

    public class SelfHealResult
    {
        public bool   Succeeded       { get; init; }
        public string Reason          { get; init; }
        public bool   RequiresHuman   { get; init; }
        public int    AttemptNumber   { get; init; }
    }

    public class RollbackResult
    {
        public bool   Succeeded { get; init; }
        public string FilePath  { get; init; }
    }
}
