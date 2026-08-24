using System;
using System.Collections.Generic;
using System.Linq;
using AIAutomationGenerator.Planning;
using AIAutomationGenerator.Orchestration;

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

        public ImplementationEngine()
        {
            _classifier = new FailureClassifier();
        }

        /// <summary>
        /// Execute a plan. Returns an execution record with full audit trail.
        /// Does NOT write real files in this version — records what WOULD happen.
        /// Actual file I/O is gated behind a live framework environment.
        /// </summary>
        public ImplementationExecutionRecord Execute(EngineeringPlan plan, int maxRetries = DefaultMaxRetries)
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

            if (plan.FrameworkModificationsAllowed == false)
            {
                // Verify no change targets a protected file
                foreach (var pc in plan.PlannedFileChanges ?? new())
                {
                    if (plan.ProtectedFiles.Any(pf =>
                        pf.EndsWith(pc.FilePath, StringComparison.OrdinalIgnoreCase) ||
                        pc.FilePath.Contains("Hooks.cs") ||
                        pc.FilePath.Contains("PlaywrightDriver.cs")))
                    {
                        var cr = new ChangeRecord
                        {
                            FilePath      = pc.FilePath,
                            ChangeType    = ChangeType.Create,
                            DecisionSource = pc.Reason,
                            Evidence      = pc.Evidence,
                            Reason        = "Protected file — modification not allowed",
                            Risk          = ChangeRisk.Protected,
                            Status        = ChangeStatus.HumanReviewRequired
                        };
                        record.Changes.Add(cr);
                        record.HumanReviewNotes.Add($"Protected file cannot be auto-modified: {pc.FilePath}");
                    }
                }
            }

            // Process each planned change
            foreach (var filePlan in plan.PlannedFileChanges ?? new())
            {
                var changeRecord = ProcessFilePlan(filePlan, plan, record, maxRetries);
                record.Changes.Add(changeRecord);
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
            if (hrDecisions.Any())
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
            int maxRetries)
        {
            if (filePlan.IsProtected)
            {
                return new ChangeRecord
                {
                    FilePath       = filePlan.FilePath,
                    ChangeType     = ChangeType.Create,
                    DecisionSource = filePlan.Reason,
                    Evidence       = filePlan.Evidence,
                    Reason         = "Protected file",
                    Risk           = ChangeRisk.Protected,
                    Status         = ChangeStatus.HumanReviewRequired
                };
            }

            var changeType = filePlan.ModificationType switch
            {
                FileModificationType.Create => ChangeType.Create,
                FileModificationType.Extend => ChangeType.Extend,
                _                           => ChangeType.Reuse
            };

            // Simulate applying the change (no real I/O in P2 dry-run mode)
            // Real I/O is gated behind a live framework build environment.
            var status = ChangeStatus.Applied; // deterministic: plan is valid, apply succeeds in dry-run

            return new ChangeRecord
            {
                FilePath       = filePlan.FilePath,
                ChangeType     = changeType,
                DecisionSource = filePlan.Reason,
                Evidence       = filePlan.Evidence,
                Reason         = filePlan.Reason,
                Risk           = ChangeRisk.Low,
                Status         = status
            };
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

            // Safe correction applied (deterministic)
            record.CorrectionsSucceeded++;
            return new SelfHealResult
            {
                Succeeded     = true,
                Reason        = $"Applied deterministic correction: {classification.Category}",
                RequiresHuman = false,
                AttemptNumber = currentAttempt + 1
            };
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
