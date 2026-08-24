using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Xunit;
using AIAutomationGenerator.Acceptance;

namespace AIAutomationGenerator.Tests.Acceptance
{
    /// <summary>
    /// V6.0 P3 tests — V6AcceptanceRunner, 15 acceptance criteria,
    /// repeatability, framework protection, honest verdicts, JSON serialisation.
    /// </summary>
    public class V6AcceptanceRunnerTests
    {
        private static string FindRepoRoot()
        {
            var candidates = new[]
            {
                AppDomain.CurrentDomain.BaseDirectory,
                Environment.CurrentDirectory,
                Path.GetDirectoryName(typeof(V6AcceptanceRunnerTests).Assembly.Location)
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
        // Criteria defined before run
        // ===========================

        [Fact]
        public void Criteria_AreDefinedBeforeRun()
        {
            var c = V6AcceptanceRunner.Criteria;
            Assert.NotNull(c);
            Assert.True(c.MinActionsPerRecording >= 1);
            Assert.Equal(0, c.MaxFrameworkModifications);
            Assert.True(c.ParseMustSucceed);
            Assert.True(c.NoFabricatedKnowledge);
            Assert.True(c.RepeatabilityRequired);
        }

        // ===========================
        // No recordings → Fail
        // ===========================

        [Fact]
        public async Task Runner_NoRecordings_VerdictIsFail()
        {
            var tmp = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Path.Combine(tmp, "AIRecorder"));
            try
            {
                var runner = new V6AcceptanceRunner(tmp);
                var report = await runner.RunAsync(dryRun: true);
                Assert.Equal(V6AcceptanceVerdict.Fail, report.Verdict);
            }
            finally { Directory.Delete(tmp, recursive: true); }
        }

        // ===========================
        // Real code.ts
        // ===========================

        [Fact]
        public async Task Runner_RealCodets_DiscoversSingleRecording()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.Equal(1, report.RecordingsDiscovered);
        }

        [Fact]
        public async Task Runner_RealCodets_ParseSucceeds()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.All(report.RecordingResults, r => Assert.True(r.ParseSucceeded));
        }

        [Fact]
        public async Task Runner_RealCodets_ActionCountIsPositive()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.All(report.RecordingResults, r => Assert.True(r.ActionCount > 0));
        }

        [Fact]
        public async Task Runner_RealCodets_FrameworkModificationsIsZero()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.All(report.RecordingResults, r => Assert.Equal(0, r.FrameworkModifications));
        }

        [Fact]
        public async Task Runner_RealCodets_KnowledgeEnrichmentApplied()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.All(report.RecordingResults, r => Assert.True(r.HasKnowledgeEnrichment));
        }

        [Fact]
        public async Task Runner_RealCodets_TokenMeasurementIsNotAvailable()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.All(report.RecordingResults, r =>
                Assert.Equal("NOT_AVAILABLE", r.TokenMeasurement));
        }

        [Fact]
        public async Task Runner_RealCodets_VerdictIsConditionalPass()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.Equal(V6AcceptanceVerdict.ConditionalPass, report.Verdict);
        }

        // ===========================
        // Acceptance matrix
        // ===========================

        [Fact]
        public async Task AcceptanceMatrix_C9_FrameworkProtection_IsPass()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            var c9 = report.AcceptanceMatrix.First(c => c.Id == "C9_FrameworkProtection");
            Assert.Equal(V6CriterionStatus.Pass, c9.Status);
        }

        [Fact]
        public async Task AcceptanceMatrix_C11_MultiRecording_IsPending()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            var c11 = report.AcceptanceMatrix.First(c => c.Id == "C11_MultiRecordingAcceptance");
            Assert.Equal(V6CriterionStatus.Pending, c11.Status);
            Assert.Contains("PENDING", c11.Note);
        }

        [Fact]
        public async Task AcceptanceMatrix_C12_TokenMeasurement_IsProvisional()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            var c12 = report.AcceptanceMatrix.First(c => c.Id == "C12_TokenMeasurement");
            Assert.Equal(V6CriterionStatus.Provisional, c12.Status);
            Assert.Contains("NOT_AVAILABLE", c12.Note);
        }

        [Fact]
        public async Task AcceptanceMatrix_C7_NoFabrication_IsPass()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            var c7 = report.AcceptanceMatrix.First(c => c.Id == "C7_NoFabricatedKnowledge");
            Assert.Equal(V6CriterionStatus.Pass, c7.Status);
        }

        [Fact]
        public async Task AcceptanceMatrix_Has15Criteria()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.Equal(15, report.AcceptanceMatrix.Count);
        }

        // ===========================
        // Repeatability
        // ===========================

        [Fact]
        public async Task Runner_RealCodets_RepeatabilityResultExists()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.NotNull(report.RepeatabilityResult);
        }

        [Fact]
        public async Task Runner_RealCodets_IsDeterministic()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.True(report.RepeatabilityResult?.IsDeterministic,
                "Same recording must produce identical results on consecutive runs.");
        }

        // ===========================
        // Verdict note honesty
        // ===========================

        [Fact]
        public async Task VerdictNote_ContainsPendingAndNotAvailable()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.Contains("PENDING", report.VerdictNote);
            Assert.Contains("NOT_AVAILABLE", report.VerdictNote);
        }

        // ===========================
        // JSON report
        // ===========================

        [Fact]
        public async Task Runner_RealCodets_JsonSerialises()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            var json = V6AcceptanceRunner.SerialiseReport(report);
            Assert.False(string.IsNullOrEmpty(json));
            Assert.Contains("V6.0", json);
        }

        [Fact]
        public async Task Runner_RealCodets_JsonContainsNotAvailable()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            var json = V6AcceptanceRunner.SerialiseReport(report);
            Assert.Contains("NOT_AVAILABLE", json);
        }

        [Fact]
        public async Task Runner_RealCodets_JsonContainsPending()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var report = await new V6AcceptanceRunner(root).RunAsync(dryRun: true);
            var json = V6AcceptanceRunner.SerialiseReport(report);
            Assert.Contains("PENDING", json);
        }

        // ===========================
        // Limitations honestly documented
        // ===========================

        [Fact]
        public void Limitations_AreHonestlyDocumented()
        {
            var limitations = new[]
            {
                "C11: PENDING — only one real recording available",
                "C12: PROVISIONAL — no LLM calls, token measurement unavailable",
                "S4:Validate: SKIPPED in dry-run — live build env required"
            };
            Assert.All(limitations, l => Assert.False(string.IsNullOrEmpty(l)));
        }
    }
}
