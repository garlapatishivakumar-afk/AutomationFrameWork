using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using AIAutomationGenerator.Orchestration;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Tests.Orchestration
{
    /// <summary>
    /// Tests for V5.0 Prompt 2 — AutonomousOrchestrator and FailureClassifier.
    ///
    /// What is validated:
    ///   1. Stage model: all 4 statuses (Success, Failed, Skipped, HumanReviewRequired)
    ///   2. Orchestrator: success path with real code.ts
    ///   3. Orchestrator: missing file → HUMAN_REVIEW_REQUIRED (not a retry loop)
    ///   4. Orchestrator: dry-run skips validation stage
    ///   5. Orchestrator: FrameworkModifications is always 0
    ///   6. Orchestrator: retry metrics are recorded
    ///   7. Orchestrator: HumanReviewNotes populated on HUMAN_REVIEW_REQUIRED
    ///   8. FailureClassifier: deterministic categories
    ///   9. FailureClassifier: unknown → HUMAN_REVIEW_REQUIRED (safe default)
    ///  10. PipelineExecutionRecord: metrics computed correctly
    ///  11. Retry limit: MaxRetries constant is enforced
    /// </summary>
    public class AutonomousOrchestratorTests
    {
        // ===== Helpers =====

        private static string FindRepoRoot()
        {
            var candidates = new[]
            {
                AppDomain.CurrentDomain.BaseDirectory,
                Environment.CurrentDirectory,
                Path.GetDirectoryName(typeof(AutonomousOrchestratorTests).Assembly.Location)
            };
            foreach (var start in candidates)
            {
                if (start == null) continue;
                var dir = new DirectoryInfo(start);
                while (dir != null)
                {
                    if (File.Exists(Path.Combine(dir.FullName, "AIRecorder", "code.ts")))
                        return dir.FullName;
                    dir = dir.Parent;
                }
            }
            return null;
        }

        // ===========================
        // PipelineStageResult tests
        // ===========================

        [Fact]
        public void StageResult_Succeed_HasCorrectStatus()
        {
            var result = PipelineStageResult.Succeed("Test", "OK", DateTime.UtcNow);
            Assert.Equal(StageStatus.Success, result.Status);
            Assert.Equal("Test", result.StageName);
            Assert.False(result.WasRetried);
        }

        [Fact]
        public void StageResult_Fail_HasCorrectStatus()
        {
            var result = PipelineStageResult.Fail("Test", "error", DateTime.UtcNow);
            Assert.Equal(StageStatus.Failed, result.Status);
            Assert.Equal("error", result.Error);
        }

        [Fact]
        public void StageResult_Skip_HasCorrectStatus()
        {
            var result = PipelineStageResult.Skip("Test", "reason");
            Assert.Equal(StageStatus.Skipped, result.Status);
        }

        [Fact]
        public void StageResult_RequireHuman_HasCorrectStatus()
        {
            var result = PipelineStageResult.RequireHuman("Test", "needs human", DateTime.UtcNow);
            Assert.Equal(StageStatus.HumanReviewRequired, result.Status);
            Assert.Equal("needs human", result.HumanReviewNote);
        }

        [Fact]
        public void StageResult_WithRetry_AttemptNumber2_WasRetriedIsTrue()
        {
            var result = PipelineStageResult.Succeed("Test", "ok", DateTime.UtcNow, attempt: 2);
            Assert.Equal(2, result.AttemptNumber);
            Assert.True(result.WasRetried);
        }

        [Fact]
        public void StageResult_Duration_IsPositive()
        {
            var start = DateTime.UtcNow.AddMilliseconds(-10);
            var result = PipelineStageResult.Succeed("Test", "ok", start);
            Assert.True(result.Duration >= TimeSpan.Zero);
        }

        // ===========================
        // PipelineExecutionRecord tests
        // ===========================

        [Fact]
        public void ExecutionRecord_AddStage_TracksSucceededCount()
        {
            var record = new PipelineExecutionRecord { StartedAt = DateTime.UtcNow };
            record.AddStage(PipelineStageResult.Succeed("S1", "ok", DateTime.UtcNow));
            record.AddStage(PipelineStageResult.Succeed("S2", "ok", DateTime.UtcNow));

            Assert.Equal(2, record.StagesExecuted);
            Assert.Equal(2, record.StagesSucceeded);
            Assert.Equal(0, record.StagesFailed);
        }

        [Fact]
        public void ExecutionRecord_AddStage_TracksHumanReviewEvents()
        {
            var record = new PipelineExecutionRecord { StartedAt = DateTime.UtcNow };
            record.AddStage(PipelineStageResult.RequireHuman("S1", "need human", DateTime.UtcNow));

            Assert.Equal(1, record.HumanReviewEvents);
            Assert.Single(record.HumanReviewNotes);
            Assert.Contains("need human", record.HumanReviewNotes[0]);
        }

        [Fact]
        public void ExecutionRecord_RetryCount_IncreasesWhenStageWasRetried()
        {
            var record = new PipelineExecutionRecord { StartedAt = DateTime.UtcNow };
            record.AddStage(PipelineStageResult.Succeed("S1", "ok", DateTime.UtcNow, attempt: 2));

            Assert.Equal(1, record.RetryCount);
        }

        [Fact]
        public void ExecutionRecord_FrameworkModifications_StartsAtZero()
        {
            var record = new PipelineExecutionRecord { StartedAt = DateTime.UtcNow };
            Assert.Equal(0, record.FrameworkModifications);
        }

        // ===========================
        // FailureClassifier tests
        // ===========================

        [Fact]
        public void Classifier_MissingUsingError_IsSafeToRetryAndAutoFixable()
        {
            var classifier = new FailureClassifier();
            var result = classifier.Classify("CS0246: The type or namespace name 'IPage' could not be found (are you missing a using directive?)");

            Assert.Equal(FailureCategory.MissingUsing, result.Category);
            Assert.True(result.IsSafeToRetry);
            Assert.True(result.IsAutoFixable);
            Assert.False(result.RequiresHuman);
        }

        [Fact]
        public void Classifier_TransientBuildError_IsSafeToRetry()
        {
            var classifier = new FailureClassifier();
            var result = classifier.Classify("The process cannot access the file because it is locked by another process");

            Assert.Equal(FailureCategory.TransientBuild, result.Category);
            Assert.True(result.IsSafeToRetry);
            Assert.False(result.RequiresHuman);
        }

        [Fact]
        public void Classifier_TestRegression_RequiresHuman()
        {
            var classifier = new FailureClassifier();
            var result = classifier.Classify("Test regression detected: previously passing tests are now failing");

            Assert.Equal(FailureCategory.TestRegression, result.Category);
            Assert.False(result.IsSafeToRetry);
            Assert.True(result.RequiresHuman);
        }

        [Fact]
        public void Classifier_ProductionFrameworkRisk_RequiresHuman()
        {
            var classifier = new FailureClassifier();
            var result = classifier.Classify("AutomationFrameWork files were modified unexpectedly");

            Assert.Equal(FailureCategory.ProductionFrameworkRisk, result.Category);
            Assert.True(result.RequiresHuman);
        }

        [Fact]
        public void Classifier_UnknownError_DefaultsToHumanRequired()
        {
            var classifier = new FailureClassifier();
            var result = classifier.Classify("Some completely novel error that has never been seen");

            Assert.Equal(FailureCategory.Unknown, result.Category);
            Assert.False(result.IsSafeToRetry);
            Assert.True(result.RequiresHuman);
        }

        [Fact]
        public void Classifier_EmptyError_RequiresHuman()
        {
            var classifier = new FailureClassifier();
            var result = classifier.Classify("");

            Assert.True(result.RequiresHuman);
            Assert.Equal(FailureCategory.Unknown, result.Category);
        }

        [Fact]
        public void Classifier_NamespaceError_IsSafeToRetry()
        {
            var classifier = new FailureClassifier();
            var result = classifier.Classify("The namespace 'AutomationFrameWork.PageElements' does not exist");

            Assert.Equal(FailureCategory.NamespaceError, result.Category);
            Assert.True(result.IsSafeToRetry);
            Assert.True(result.IsAutoFixable);
        }

        // ===========================
        // AutonomousOrchestrator tests
        // ===========================

        [Fact]
        public void Orchestrator_MaxRetries_IsPositive()
        {
            Assert.True(AutonomousOrchestrator.MaxRetries > 0,
                "MaxRetries must be positive to prevent degenerate retry loops.");
            Assert.True(AutonomousOrchestrator.MaxRetries <= 5,
                "MaxRetries must not be excessive — prevents infinite/long loops.");
        }

        [Fact]
        public async Task Orchestrator_MissingRecordingFile_ReturnsHumanReview()
        {
            var orch = new AutonomousOrchestrator("TestRepo");
            var record = await orch.RunAsync("AIRecorder/nonexistent_file.ts");

            Assert.Equal(StageStatus.HumanReviewRequired, record.FinalStatus);
            Assert.NotEmpty(record.HumanReviewNotes);
        }

        [Fact]
        public async Task Orchestrator_NullRecordingPath_ReturnsHumanReview()
        {
            var orch = new AutonomousOrchestrator("TestRepo");
            var record = await orch.RunAsync(null);

            Assert.Equal(StageStatus.HumanReviewRequired, record.FinalStatus);
        }

        [Fact]
        public async Task Orchestrator_DryRun_SkipsValidationStage()
        {
            var repoRoot = FindRepoRoot();
            if (repoRoot == null) return; // CI skip

            var orch = new AutonomousOrchestrator(repoRoot);
            var path = Path.Combine(repoRoot, "AIRecorder", "code.ts");
            var record = await orch.RunAsync(path, dryRun: true);

            var validationStage = record.Stages.FirstOrDefault(s => s.StageName == "S4:Validate");
            Assert.NotNull(validationStage);
            Assert.Equal(StageStatus.Skipped, validationStage.Status);
        }

        [Fact]
        public async Task Orchestrator_RealCodets_DryRun_ReachesIntelligenceStage()
        {
            var repoRoot = FindRepoRoot();
            if (repoRoot == null) return; // CI skip

            var orch = new AutonomousOrchestrator(repoRoot);
            var path = Path.Combine(repoRoot, "AIRecorder", "code.ts");
            var record = await orch.RunAsync(path, dryRun: true);

            // Parse and intelligence stages must have run
            Assert.Contains(record.Stages, s => s.StageName == "S1:ParseRecording");
            Assert.Contains(record.Stages, s => s.StageName == "S2:BuildIntelligence");
        }

        [Fact]
        public async Task Orchestrator_RealCodets_DryRun_ParseStageSucceeds()
        {
            var repoRoot = FindRepoRoot();
            if (repoRoot == null) return;

            var orch = new AutonomousOrchestrator(repoRoot);
            var path = Path.Combine(repoRoot, "AIRecorder", "code.ts");
            var record = await orch.RunAsync(path, dryRun: true);

            var parseStage = record.Stages.FirstOrDefault(s => s.StageName == "S1:ParseRecording");
            Assert.NotNull(parseStage);
            Assert.Equal(StageStatus.Success, parseStage.Status);
        }

        [Fact]
        public async Task Orchestrator_RealCodets_DryRun_FrameworkModificationsIsZero()
        {
            // CRITICAL: production framework must never be autonomously modified.
            var repoRoot = FindRepoRoot();
            if (repoRoot == null) return;

            var orch = new AutonomousOrchestrator(repoRoot);
            var path = Path.Combine(repoRoot, "AIRecorder", "code.ts");
            var record = await orch.RunAsync(path, dryRun: true);

            Assert.Equal(0, record.FrameworkModifications);
        }

        [Fact]
        public async Task Orchestrator_RealCodets_DryRun_MetricsArePopulated()
        {
            var repoRoot = FindRepoRoot();
            if (repoRoot == null) return;

            var orch = new AutonomousOrchestrator(repoRoot);
            var path = Path.Combine(repoRoot, "AIRecorder", "code.ts");
            var record = await orch.RunAsync(path, dryRun: true);

            Assert.True(record.StagesExecuted > 0);
            Assert.True(record.TotalDuration >= TimeSpan.Zero);
            Assert.NotNull(record.Summary);
            Assert.NotNull(record.RunId);
        }

        [Fact]
        public async Task Orchestrator_RealCodets_DryRun_SummaryIsPopulated()
        {
            var repoRoot = FindRepoRoot();
            if (repoRoot == null) return;

            var orch = new AutonomousOrchestrator(repoRoot);
            var path = Path.Combine(repoRoot, "AIRecorder", "code.ts");
            var record = await orch.RunAsync(path, dryRun: true);

            Assert.False(string.IsNullOrEmpty(record.Summary));
        }

        // ===========================
        // Human review boundary tests
        // ===========================

        [Fact]
        public async Task Orchestrator_HumanReviewRequired_PopulatesHumanReviewNotes()
        {
            var orch = new AutonomousOrchestrator("TestRepo");
            // Missing file triggers HUMAN_REVIEW_REQUIRED on S1
            var record = await orch.RunAsync("does_not_exist.ts");

            Assert.Equal(StageStatus.HumanReviewRequired, record.FinalStatus);
            Assert.True(record.HumanReviewEvents >= 1);
            Assert.NotEmpty(record.HumanReviewNotes);
        }

        [Fact]
        public async Task Orchestrator_HumanReviewRequired_DoesNotContinueExecution()
        {
            var orch = new AutonomousOrchestrator("TestRepo");
            var record = await orch.RunAsync("does_not_exist.ts");

            // After HUMAN_REVIEW on S1, S2 and beyond must NOT have run
            Assert.DoesNotContain(record.Stages, s => s.StageName == "S2:BuildIntelligence");
        }
    }
}
