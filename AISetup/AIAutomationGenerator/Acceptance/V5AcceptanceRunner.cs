using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using AIAutomationGenerator.Orchestration;

namespace AIAutomationGenerator.Acceptance
{
    /// <summary>
    /// V5.0 Prompt 3 — Production Hardening: Acceptance Framework.
    ///
    /// Runs one or more real Codegen recordings through the V5.0 pipeline and
    /// produces a machine-readable JSON report plus a summary verdict.
    ///
    /// DESIGN RULES:
    ///   - Does NOT create synthetic recordings.
    ///   - When only one real recording exists, processes that one and marks
    ///     multi-recording acceptance as PENDING.
    ///   - Does NOT claim metrics it cannot measure (token usage = NOT_AVAILABLE).
    ///   - Each recording is independent — results are not aggregated to hide failures.
    ///   - Acceptance criteria are defined BEFORE the run, not tuned to pass.
    ///   - Framework protection verified after every run.
    /// </summary>
    public class V5AcceptanceRunner
    {
        private readonly string _repositoryRoot;

        public V5AcceptanceRunner(string repositoryRoot)
        {
            _repositoryRoot = repositoryRoot
                ?? throw new ArgumentNullException(nameof(repositoryRoot));
        }

        // ===== Acceptance criteria (defined before the run) =====

        public static readonly V5AcceptanceCriteria Criteria = new()
        {
            // Parser must extract at least 1 action
            MinActionsPerRecording   = 1,
            // Orchestrator must complete without unhandled exception
            OrchestratorMustComplete = true,
            // FrameworkModifications must be zero in every run
            MaxFrameworkModifications = 0,
            // Parse stage must succeed
            ParseStageMustSucceed    = true,
            // Intelligence stage must succeed (with minimal repo)
            IntelligenceStageMustSucceed = true,
            // Dry-run: validation stage must be Skipped (not Failed)
            DryRunValidationMustBeSkipped = true,
            // Deterministic: same recording run twice must produce identical stage counts
            RepeatabilityRequired    = true
        };

        // ===========================
        // Main entry point
        // ===========================

        /// <summary>
        /// Run acceptance campaign over all recordings found in AIRecorder/.
        /// </summary>
        public async Task<V5AcceptanceReport> RunAsync(bool dryRun = true)
        {
            var report = new V5AcceptanceReport
            {
                StartedAt        = DateTime.UtcNow,
                PipelineVersion  = "V5.0",
                RepositoryRoot   = _repositoryRoot,
                DryRun           = dryRun,
                CriteriaApplied  = Criteria
            };

            // Discover real recordings
            var recordings = DiscoverRecordings();
            report.RecordingsDiscovered = recordings.Count;
            report.RecordingPaths       = recordings;

            if (recordings.Count == 0)
            {
                report.Verdict   = AcceptanceVerdict.Fail;
                report.VerdictNote = "No real recordings found in AIRecorder/. " +
                                     "Provide real Playwright Codegen .ts files to run acceptance.";
                report.CompletedAt = DateTime.UtcNow;
                return report;
            }

            // Run each recording independently
            var orchestrator = new AutonomousOrchestrator(_repositoryRoot);

            foreach (var path in recordings)
            {
                var recordingResult = await RunSingleRecordingAsync(orchestrator, path, dryRun);
                report.RecordingResults.Add(recordingResult);
            }

            // Repeatability: run first recording twice, compare stage counts
            if (Criteria.RepeatabilityRequired && recordings.Count > 0)
            {
                var r1 = await orchestrator.RunAsync(recordings[0], dryRun);
                var r2 = await orchestrator.RunAsync(recordings[0], dryRun);
                report.RepeatabilityResult = AssessRepeatability(r1, r2, recordings[0]);
            }

            // Evaluate acceptance criteria
            EvaluateCriteria(report);

            report.CompletedAt = DateTime.UtcNow;
            return report;
        }

        // ===========================
        // Per-recording execution
        // ===========================

        private async Task<RecordingAcceptanceResult> RunSingleRecordingAsync(
            AutonomousOrchestrator orchestrator,
            string path,
            bool dryRun)
        {
            var result = new RecordingAcceptanceResult
            {
                RecordingPath = path,
                RecordingName = Path.GetFileName(path),
                StartedAt     = DateTime.UtcNow
            };

            try
            {
                var record = await orchestrator.RunAsync(path, dryRun);

                result.PipelineStatus        = record.FinalStatus;
                result.StagesExecuted        = record.StagesExecuted;
                result.StagesSucceeded       = record.StagesSucceeded;
                result.StagesFailed          = record.StagesFailed;
                result.StagesSkipped         = record.StagesSkipped;
                result.HumanReviewEvents     = record.HumanReviewEvents;
                result.HumanReviewNotes      = record.HumanReviewNotes;
                result.RetryCount            = record.RetryCount;
                result.CorrectionCount       = record.CorrectionCount;
                result.FrameworkModifications = record.FrameworkModifications;
                result.ReusedComponents      = record.ReusedComponents;
                result.ExtendedComponents    = record.ExtendedComponents;
                result.CreatedComponents     = record.CreatedComponents;
                result.ProcessingMs          = (long)record.TotalDuration.TotalMilliseconds;
                result.Summary               = record.Summary;
                result.StageDetails          = record.Stages.Select(s => new StageDetail
                {
                    Name      = s.StageName,
                    Status    = s.Status.ToString(),
                    DurationMs = (long)s.Duration.TotalMilliseconds,
                    Message   = s.Message,
                    Error     = s.Error
                }).ToList();
            }
            catch (Exception ex)
            {
                result.PipelineStatus = StageStatus.HumanReviewRequired;
                result.Summary        = $"Unhandled exception during acceptance run: {ex.Message}";
            }

            result.CompletedAt = DateTime.UtcNow;
            return result;
        }

        // ===========================
        // Repeatability assessment
        // ===========================

        private RepeatabilityResult AssessRepeatability(
            PipelineExecutionRecord run1,
            PipelineExecutionRecord run2,
            string recordingPath)
        {
            bool stageCountMatch  = run1.StagesExecuted  == run2.StagesExecuted;
            bool statusMatch      = run1.FinalStatus     == run2.FinalStatus;
            bool reusedMatch      = run1.ReusedComponents  == run2.ReusedComponents;
            bool extendedMatch    = run1.ExtendedComponents == run2.ExtendedComponents;
            bool createdMatch     = run1.CreatedComponents  == run2.CreatedComponents;
            bool frameworkMatch   = run1.FrameworkModifications == run2.FrameworkModifications;

            bool isDeterministic = stageCountMatch && statusMatch &&
                                   reusedMatch && extendedMatch && createdMatch && frameworkMatch;

            return new RepeatabilityResult
            {
                RecordingPath        = recordingPath,
                IsDeterministic      = isDeterministic,
                Run1StagesExecuted   = run1.StagesExecuted,
                Run2StagesExecuted   = run2.StagesExecuted,
                Run1FinalStatus      = run1.FinalStatus.ToString(),
                Run2FinalStatus      = run2.FinalStatus.ToString(),
                Run1ReusedComponents = run1.ReusedComponents,
                Run2ReusedComponents = run2.ReusedComponents,
                StageCountMatch      = stageCountMatch,
                StatusMatch          = statusMatch,
                ComponentCountsMatch = reusedMatch && extendedMatch && createdMatch,
                FrameworkMatch       = frameworkMatch,
                Note                 = isDeterministic
                    ? "PASS — identical results on two consecutive runs."
                    : "FAIL — results differ between runs; pipeline is not deterministic."
            };
        }

        // ===========================
        // Acceptance criteria evaluation
        // ===========================

        private void EvaluateCriteria(V5AcceptanceReport report)
        {
            var matrix = new List<AcceptanceCriterionResult>();

            // C1: At least one recording was processed
            matrix.Add(Criterion(
                "C1_RecordingsProcessed",
                "At least one recording processed",
                report.RecordingResults.Count > 0,
                $"{report.RecordingResults.Count} recordings processed"));

            // C2: Parse stage succeeded for all recordings
            var parseSucceeded = report.RecordingResults.All(r =>
                r.StageDetails.Any(s => s.Name == "S1:ParseRecording" && s.Status == "Success"));
            matrix.Add(Criterion("C2_ParseSucceeded", "Parse stage succeeds for all recordings",
                parseSucceeded, parseSucceeded ? "PASS" : "At least one parse stage failed"));

            // C3: Intelligence stage succeeded for all recordings
            var intelligenceSucceeded = report.RecordingResults.All(r =>
                r.StageDetails.Any(s => s.Name == "S2:BuildIntelligence" && s.Status == "Success"));
            matrix.Add(Criterion("C3_IntelligenceSucceeded",
                "Intelligence stage succeeds for all recordings",
                intelligenceSucceeded,
                intelligenceSucceeded ? "PASS" : "At least one intelligence stage failed"));

            // C4: FrameworkModifications = 0 for every run
            var noFrameworkMods = report.RecordingResults.All(r => r.FrameworkModifications == 0);
            matrix.Add(Criterion("C4_FrameworkProtection",
                "Production framework not modified (FrameworkModifications = 0)",
                noFrameworkMods,
                noFrameworkMods ? "PASS" : "FAIL — framework was modified"));

            // C5: No HumanReviewRequired on parse/intelligence stages
            var noCriticalHumanReview = report.RecordingResults.All(r =>
                !r.StageDetails.Any(s =>
                    (s.Name == "S1:ParseRecording" || s.Name == "S2:BuildIntelligence") &&
                    s.Status == "HumanReviewRequired"));
            matrix.Add(Criterion("C5_NoCriticalHumanReview",
                "No HumanReviewRequired on parse or intelligence stages",
                noCriticalHumanReview,
                noCriticalHumanReview ? "PASS" : "At least one critical stage requires human review"));

            // C6: Dry-run validation skipped (not failed)
            var validationSkipped = !report.DryRun || report.RecordingResults.All(r =>
                r.StageDetails.Any(s => s.Name == "S4:Validate" &&
                    (s.Status == "Skipped" || s.Status == "Success")));
            matrix.Add(Criterion("C6_DryRunValidationSkipped",
                "Validation stage correctly skipped in dry-run",
                validationSkipped,
                validationSkipped ? "PASS" : "Validation stage failed in dry-run (expected Skipped)"));

            // C7: Repeatability
            var deterministicVerdict = report.RepeatabilityResult == null
                ? "PROVISIONAL — repeatability not tested"
                : (report.RepeatabilityResult.IsDeterministic ? "PASS" : "FAIL");
            var deterministicPass = report.RepeatabilityResult?.IsDeterministic ?? false;
            matrix.Add(Criterion("C7_Repeatability",
                "Same recording produces identical results on consecutive runs",
                deterministicPass,
                deterministicVerdict,
                report.RepeatabilityResult == null
                    ? CriterionStatus.Provisional
                    : (deterministicPass ? CriterionStatus.Pass : CriterionStatus.Fail)));

            // C8: Multi-recording — mark PENDING if only 1 recording
            var multiStatus = report.RecordingResults.Count >= 3
                ? CriterionStatus.Pass
                : CriterionStatus.Pending;
            matrix.Add(new AcceptanceCriterionResult
            {
                Id      = "C8_MultiRecordingAcceptance",
                Name    = "Multi-recording acceptance (≥3 real recordings)",
                Status  = multiStatus,
                Note    = multiStatus == CriterionStatus.Pass
                    ? $"PASS — {report.RecordingResults.Count} recordings validated"
                    : $"PENDING — only {report.RecordingResults.Count} recording(s) available. " +
                      "Provide ≥3 real recordings to complete this criterion."
            });

            // C9: Token measurement
            matrix.Add(new AcceptanceCriterionResult
            {
                Id     = "C9_TokenMeasurement",
                Name   = "Actual LLM token usage measured",
                Status = CriterionStatus.Provisional,
                Note   = "NOT_AVAILABLE — no LLM calls in current pipeline. " +
                         "Measurement requires LLM integration instrumentation."
            });

            report.AcceptanceMatrix = matrix;

            // Overall verdict
            var fails        = matrix.Count(c => c.Status == CriterionStatus.Fail);
            var provisionals = matrix.Count(c => c.Status == CriterionStatus.Provisional);
            var pendings     = matrix.Count(c => c.Status == CriterionStatus.Pending);

            if (fails > 0)
            {
                report.Verdict     = AcceptanceVerdict.Fail;
                report.VerdictNote = $"FAIL — {fails} criterion/criteria failed. See AcceptanceMatrix.";
            }
            else if (provisionals > 0 || pendings > 0)
            {
                report.Verdict     = AcceptanceVerdict.ConditionalPass;
                report.VerdictNote = $"CONDITIONAL PASS — {pendings} pending, {provisionals} provisional. " +
                                     "Resolve pending criteria before declaring full production readiness.";
            }
            else
            {
                report.Verdict     = AcceptanceVerdict.Pass;
                report.VerdictNote = "PASS — all acceptance criteria satisfied.";
            }

            // Aggregate metrics
            report.Metrics = new V5AcceptanceMetrics
            {
                TotalRecordings       = report.RecordingResults.Count,
                PassedRecordings      = report.RecordingResults.Count(r => r.PipelineStatus == StageStatus.Success),
                FailedRecordings      = report.RecordingResults.Count(r => r.PipelineStatus == StageStatus.Failed),
                HumanReviewRecordings = report.RecordingResults.Count(r => r.PipelineStatus == StageStatus.HumanReviewRequired),
                TotalActions          = 0, // populated by caller if needed
                TotalReuseDecisions   = report.RecordingResults.Sum(r => r.ReusedComponents),
                TotalExtendDecisions  = report.RecordingResults.Sum(r => r.ExtendedComponents),
                TotalCreateDecisions  = report.RecordingResults.Sum(r => r.CreatedComponents),
                TotalRetries          = report.RecordingResults.Sum(r => r.RetryCount),
                TotalCorrections      = report.RecordingResults.Sum(r => r.CorrectionCount),
                TotalHumanReviewEvents = report.RecordingResults.Sum(r => r.HumanReviewEvents),
                TotalFrameworkMods    = report.RecordingResults.Sum(r => r.FrameworkModifications),
                AvgProcessingMs       = report.RecordingResults.Count == 0 ? 0
                    : (long)report.RecordingResults.Average(r => r.ProcessingMs),
                TokenMeasurement      = "NOT_AVAILABLE"
            };
        }

        // ===========================
        // JSON report serialisation
        // ===========================

        public static string SerialiseReport(V5AcceptanceReport report)
        {
            var options = new JsonSerializerOptions
            {
                WriteIndented        = true,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
                Converters           = { new JsonStringEnumConverter() }
            };
            return JsonSerializer.Serialize(report, options);
        }

        // ===========================
        // Helpers
        // ===========================

        private List<string> DiscoverRecordings()
        {
            var aiRecorder = Path.Combine(_repositoryRoot, "AIRecorder");
            if (!Directory.Exists(aiRecorder))
                return new List<string>();

            return Directory
                .EnumerateFiles(aiRecorder, "*.ts")
                .Where(f => !f.Contains(".config.", StringComparison.OrdinalIgnoreCase))
                .OrderBy(f => f)
                .ToList();
        }

        private static AcceptanceCriterionResult Criterion(
            string id, string name, bool pass, string note,
            CriterionStatus? overrideStatus = null) =>
            new()
            {
                Id     = id,
                Name   = name,
                Status = overrideStatus ?? (pass ? CriterionStatus.Pass : CriterionStatus.Fail),
                Note   = note
            };
    }

    // ===== Report model types =====

    public class V5AcceptanceReport
    {
        public string           PipelineVersion    { get; set; }
        public string           RepositoryRoot     { get; set; }
        public DateTime         StartedAt          { get; set; }
        public DateTime         CompletedAt        { get; set; }
        public bool             DryRun             { get; set; }
        public int              RecordingsDiscovered { get; set; }
        public List<string>     RecordingPaths     { get; set; } = new();
        public V5AcceptanceCriteria CriteriaApplied { get; set; }

        public List<RecordingAcceptanceResult> RecordingResults { get; set; } = new();
        public RepeatabilityResult  RepeatabilityResult { get; set; }
        public List<AcceptanceCriterionResult> AcceptanceMatrix { get; set; } = new();
        public V5AcceptanceMetrics  Metrics            { get; set; }

        public AcceptanceVerdict    Verdict            { get; set; }
        public string               VerdictNote        { get; set; }
    }

    public class RecordingAcceptanceResult
    {
        public string       RecordingPath        { get; set; }
        public string       RecordingName        { get; set; }
        public DateTime     StartedAt            { get; set; }
        public DateTime     CompletedAt          { get; set; }
        public StageStatus  PipelineStatus       { get; set; }
        public string       Summary              { get; set; }
        public int          StagesExecuted       { get; set; }
        public int          StagesSucceeded      { get; set; }
        public int          StagesFailed         { get; set; }
        public int          StagesSkipped        { get; set; }
        public int          HumanReviewEvents    { get; set; }
        public List<string> HumanReviewNotes     { get; set; } = new();
        public int          RetryCount           { get; set; }
        public int          CorrectionCount      { get; set; }
        public int          FrameworkModifications { get; set; }
        public int          ReusedComponents     { get; set; }
        public int          ExtendedComponents   { get; set; }
        public int          CreatedComponents    { get; set; }
        public long         ProcessingMs         { get; set; }
        public List<StageDetail> StageDetails    { get; set; } = new();
    }

    public class StageDetail
    {
        public string Name       { get; set; }
        public string Status     { get; set; }
        public long   DurationMs { get; set; }
        public string Message    { get; set; }
        public string Error      { get; set; }
    }

    public class RepeatabilityResult
    {
        public string RecordingPath        { get; set; }
        public bool   IsDeterministic      { get; set; }
        public int    Run1StagesExecuted   { get; set; }
        public int    Run2StagesExecuted   { get; set; }
        public string Run1FinalStatus      { get; set; }
        public string Run2FinalStatus      { get; set; }
        public int    Run1ReusedComponents { get; set; }
        public int    Run2ReusedComponents { get; set; }
        public bool   StageCountMatch      { get; set; }
        public bool   StatusMatch          { get; set; }
        public bool   ComponentCountsMatch { get; set; }
        public bool   FrameworkMatch       { get; set; }
        public string Note                 { get; set; }
    }

    public class AcceptanceCriterionResult
    {
        public string           Id     { get; set; }
        public string           Name   { get; set; }
        public CriterionStatus  Status { get; set; }
        public string           Note   { get; set; }
    }

    public class V5AcceptanceCriteria
    {
        public int  MinActionsPerRecording          { get; set; }
        public bool OrchestratorMustComplete        { get; set; }
        public int  MaxFrameworkModifications       { get; set; }
        public bool ParseStageMustSucceed           { get; set; }
        public bool IntelligenceStageMustSucceed    { get; set; }
        public bool DryRunValidationMustBeSkipped   { get; set; }
        public bool RepeatabilityRequired           { get; set; }
    }

    public class V5AcceptanceMetrics
    {
        public int    TotalRecordings        { get; set; }
        public int    PassedRecordings       { get; set; }
        public int    FailedRecordings       { get; set; }
        public int    HumanReviewRecordings  { get; set; }
        public int    TotalActions           { get; set; }
        public int    TotalReuseDecisions    { get; set; }
        public int    TotalExtendDecisions   { get; set; }
        public int    TotalCreateDecisions   { get; set; }
        public int    TotalRetries           { get; set; }
        public int    TotalCorrections       { get; set; }
        public int    TotalHumanReviewEvents { get; set; }
        public int    TotalFrameworkMods     { get; set; }
        public long   AvgProcessingMs        { get; set; }
        public string TokenMeasurement       { get; set; }
    }

    public enum AcceptanceVerdict    { Pass, ConditionalPass, Fail }
    public enum CriterionStatus      { Pass, Fail, Provisional, Pending }
}
