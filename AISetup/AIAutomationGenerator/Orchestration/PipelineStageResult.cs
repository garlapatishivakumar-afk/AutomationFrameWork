using System;
using System.Collections.Generic;

namespace AIAutomationGenerator.Orchestration
{
    /// <summary>
    /// V5.0 Prompt 2 — Stage execution model.
    ///
    /// Every stage in the autonomous pipeline must produce one of these states.
    /// This gives downstream stages and the human operator a clear picture
    /// of what happened and what is required next.
    /// </summary>
    public enum StageStatus
    {
        /// <summary>Stage completed without errors.</summary>
        Success,

        /// <summary>Stage failed but failure is deterministic and safe to retry or auto-correct.</summary>
        Failed,

        /// <summary>Stage was intentionally not executed (e.g., dry-run, dependency skipped).</summary>
        Skipped,

        /// <summary>
        /// Stage failed in a way that is ambiguous or risky.
        /// Autonomous pipeline MUST stop here. Human decision required.
        /// </summary>
        HumanReviewRequired
    }

    /// <summary>
    /// Result of a single pipeline stage execution.
    /// Immutable snapshot — never mutated after creation.
    /// </summary>
    public class PipelineStageResult
    {
        public string StageName        { get; init; }
        public StageStatus Status       { get; init; }
        public string Message          { get; init; }
        public string Error            { get; init; }
        public DateTime StartedAt      { get; init; }
        public DateTime CompletedAt    { get; init; }
        public int AttemptNumber       { get; init; }
        public bool WasRetried         { get; init; }
        public string HumanReviewNote  { get; init; }

        public TimeSpan Duration => CompletedAt - StartedAt;

        // ===== Factory methods for clarity at call sites =====

        public static PipelineStageResult Succeed(string name, string message, DateTime start, int attempt = 1) =>
            new()
            {
                StageName     = name,
                Status        = StageStatus.Success,
                Message       = message,
                StartedAt     = start,
                CompletedAt   = DateTime.UtcNow,
                AttemptNumber = attempt,
                WasRetried    = attempt > 1
            };

        public static PipelineStageResult Fail(string name, string error, DateTime start, int attempt = 1) =>
            new()
            {
                StageName     = name,
                Status        = StageStatus.Failed,
                Error         = error,
                StartedAt     = start,
                CompletedAt   = DateTime.UtcNow,
                AttemptNumber = attempt,
                WasRetried    = attempt > 1
            };

        public static PipelineStageResult Skip(string name, string reason) =>
            new()
            {
                StageName   = name,
                Status      = StageStatus.Skipped,
                Message     = reason,
                StartedAt   = DateTime.UtcNow,
                CompletedAt = DateTime.UtcNow
            };

        public static PipelineStageResult RequireHuman(string name, string note, DateTime start) =>
            new()
            {
                StageName        = name,
                Status           = StageStatus.HumanReviewRequired,
                HumanReviewNote  = note,
                Error            = note,
                StartedAt        = start,
                CompletedAt      = DateTime.UtcNow
            };
    }

    /// <summary>
    /// Complete record of one autonomous pipeline run.
    /// Produced by AutonomousOrchestrator.RunAsync().
    /// </summary>
    public class PipelineExecutionRecord
    {
        public string   RunId               { get; init; } = Guid.NewGuid().ToString("N")[..8];
        public DateTime StartedAt           { get; set; }
        public DateTime CompletedAt         { get; set; }
        public TimeSpan TotalDuration       => CompletedAt - StartedAt;

        /// <summary>Final outcome of the run.</summary>
        public StageStatus FinalStatus      { get; set; }

        /// <summary>Human-readable summary of outcome.</summary>
        public string Summary               { get; set; }

        /// <summary>Ordered list of stage results — one entry per stage executed.</summary>
        public List<PipelineStageResult> Stages { get; } = new();

        // ===== Per-run metrics (all exact counts, no estimates) =====

        public int   StagesExecuted         { get; set; }
        public int   StagesSucceeded        { get; set; }
        public int   StagesFailed           { get; set; }
        public int   StagesSkipped          { get; set; }
        public int   HumanReviewEvents      { get; set; }
        public int   RetryCount             { get; set; }
        public int   CorrectionCount        { get; set; }
        public int   FailuresNotCorrected   { get; set; }
        public int   GeneratedComponents    { get; set; }
        public int   ReusedComponents       { get; set; }
        public int   ExtendedComponents     { get; set; }
        public int   CreatedComponents      { get; set; }
        public int   BuildAttempts          { get; set; }
        public int   TestAttempts           { get; set; }
        public int   FrameworkModifications { get; set; } // Must always be 0

        /// <summary>Any HUMAN_REVIEW_REQUIRED events with their notes.</summary>
        public List<string> HumanReviewNotes { get; } = new();

        public void AddStage(PipelineStageResult stage)
        {
            Stages.Add(stage);
            StagesExecuted++;

            switch (stage.Status)
            {
                case StageStatus.Success:              StagesSucceeded++;    break;
                case StageStatus.Failed:               StagesFailed++;       break;
                case StageStatus.Skipped:              StagesSkipped++;      break;
                case StageStatus.HumanReviewRequired:
                    StagesFailed++;
                    HumanReviewEvents++;
                    if (!string.IsNullOrEmpty(stage.HumanReviewNote))
                        HumanReviewNotes.Add($"[{stage.StageName}] {stage.HumanReviewNote}");
                    break;
            }

            if (stage.WasRetried)
                RetryCount++;
        }
    }
}
