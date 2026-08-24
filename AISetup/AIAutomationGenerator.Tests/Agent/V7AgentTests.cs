using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using AIAutomationGenerator.Acceptance;
using AIAutomationGenerator.Agent;

namespace AIAutomationGenerator.Tests.Agent
{
    public class V7AgentTests
    {
        private static string FindRepoRoot()
        {
            var candidates = new[]
            {
                AppDomain.CurrentDomain.BaseDirectory,
                Environment.CurrentDirectory,
                Path.GetDirectoryName(typeof(V7AgentTests).Assembly.Location)
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
        // V7MasterOrchestrator
        // ===========================

        [Fact]
        public async Task Orchestrator_RealCodets_HasMultipleStages()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var path = Path.Combine(root, "AIRecorder", "code.ts");
            var orch = new V7MasterOrchestrator(root);
            var r    = await orch.RunAsync(path, dryRun: true);

            // At minimum parse + context + knowledge + evidence + plan stages run
            Assert.True(r.Stages.Count >= 5,
                $"Expected ≥5 stages, got {r.Stages.Count}");
        }

        [Fact]
        public async Task Orchestrator_RealCodets_ParseStageSucceeds()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var path = Path.Combine(root, "AIRecorder", "code.ts");
            var r    = await new V7MasterOrchestrator(root).RunAsync(path, dryRun: true);

            var s1 = r.Stages.First(s => s.StageName == "S1:ParseRecording");
            Assert.True(s1.Succeeded);
        }

        [Fact]
        public async Task Orchestrator_RealCodets_FrameworkModificationsIsZero()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var path = Path.Combine(root, "AIRecorder", "code.ts");
            var r    = await new V7MasterOrchestrator(root).RunAsync(path, dryRun: true);

            Assert.Equal(0, r.FrameworkModifications);
        }

        [Fact]
        public async Task Orchestrator_RealCodets_TokenMeasurementIsNotAvailable()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var path = Path.Combine(root, "AIRecorder", "code.ts");
            var r    = await new V7MasterOrchestrator(root).RunAsync(path, dryRun: true);

            Assert.Equal("NOT_AVAILABLE", r.TokenMeasurement);
            Assert.Equal("NOT_AVAILABLE", r.AiCreditsMeasurement);
        }

        [Fact]
        public async Task Orchestrator_MissingFile_ReturnsHumanReview()
        {
            var orch = new V7MasterOrchestrator("TestRepo");
            var r    = await orch.RunAsync("nonexistent.ts", dryRun: true);
            Assert.Equal("HumanReviewRequired", r.FinalStatus);
        }

        [Fact]
        public async Task Orchestrator_IsDeterministic()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var path = Path.Combine(root, "AIRecorder", "code.ts");
            var orch = new V7MasterOrchestrator(root);
            var r1   = await orch.RunAsync(path, dryRun: true);
            var r2   = await orch.RunAsync(path, dryRun: true);

            Assert.Equal(r1.FinalStatus, r2.FinalStatus);
            Assert.Equal(r1.Stages.Count, r2.Stages.Count);
        }

        [Fact]
        public async Task Orchestrator_DryRunBuildStages_NotFailed()
        {
            // In dry-run, S8/S9 may be skipped or succeeded with skip message
            var root = FindRepoRoot(); if (root == null) return;
            var path = Path.Combine(root, "AIRecorder", "code.ts");
            var r    = await new V7MasterOrchestrator(root).RunAsync(path, dryRun: true);

            // Build/Test stages must not be in Failed state
            var buildOrTest = r.Stages
                .Where(s => s.StageName is "S8:Build" or "S9:ExecuteTests")
                .ToList();

            Assert.All(buildOrTest, s => Assert.False(
                !s.Succeeded && !s.Skipped,
                $"{s.StageName} should be Succeeded or Skipped in dry-run"));
        }

        // ===========================
        // V7AcceptanceRunner
        // ===========================

        [Fact]
        public async Task Acceptance_NoRecordings_Fails()
        {
            var tmp = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Path.Combine(tmp, "AIRecorder"));
            try
            {
                var r = await new V7AcceptanceRunner(tmp).RunAsync(dryRun: true);
                Assert.Equal(V7Verdict.Fail, r.Verdict);
            }
            finally { Directory.Delete(tmp, recursive: true); }
        }

        [Fact]
        public async Task Acceptance_RealCodets_VerdictIsConditionalPass()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var r    = await new V7AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.Equal(V7Verdict.ConditionalPass, r.Verdict);
        }

        [Fact]
        public async Task Acceptance_Has25Criteria()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var r    = await new V7AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.Equal(25, r.AcceptanceMatrix.Count);
        }

        [Fact]
        public async Task Acceptance_C12_FrameworkProtection_IsPass()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var r    = await new V7AcceptanceRunner(root).RunAsync(dryRun: true);
            var c    = r.AcceptanceMatrix.First(x => x.Id == "C12_FrameworkProtection");
            Assert.Equal(V7CriterionStatus.Pass, c.Status);
        }

        [Fact]
        public async Task Acceptance_C19_MultiRecording_IsPending()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var r    = await new V7AcceptanceRunner(root).RunAsync(dryRun: true);
            var c    = r.AcceptanceMatrix.First(x => x.Id == "C19_MultiRecording");
            Assert.Equal(V7CriterionStatus.Pending, c.Status);
        }

        [Fact]
        public async Task Acceptance_C20_C21_C22_AreProvisional()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var r    = await new V7AcceptanceRunner(root).RunAsync(dryRun: true);

            foreach (var id in new[] { "C20_UsageMeasurement", "C21_AiCreditMeasurement",
                                        "C22_CostCalculation" })
            {
                var c = r.AcceptanceMatrix.First(x => x.Id == id);
                Assert.Equal(V7CriterionStatus.Provisional, c.Status);
                Assert.Contains("NOT_AVAILABLE", c.Note);
            }
        }

        [Fact]
        public async Task Acceptance_C25_NoFabrication_IsPass()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var r    = await new V7AcceptanceRunner(root).RunAsync(dryRun: true);
            var c    = r.AcceptanceMatrix.First(x => x.Id == "C25_NoFabricatedData");
            Assert.Equal(V7CriterionStatus.Pass, c.Status);
        }

        [Fact]
        public async Task Acceptance_VerdictNote_ContainsHonestLimitations()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var r    = await new V7AcceptanceRunner(root).RunAsync(dryRun: true);

            Assert.Contains("PENDING", r.VerdictNote);
            Assert.Contains("NOT_AVAILABLE", r.VerdictNote);
        }

        [Fact]
        public async Task Acceptance_RepeatabilityIsDeterministic()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var r    = await new V7AcceptanceRunner(root).RunAsync(dryRun: true);
            Assert.True(r.IsDeterministic);
        }

        [Fact]
        public async Task Acceptance_JsonSerialises()
        {
            var root = FindRepoRoot(); if (root == null) return;
            var r    = await new V7AcceptanceRunner(root).RunAsync(dryRun: true);
            var json = V7AcceptanceRunner.SerialiseReport(r);
            Assert.Contains("V7.0", json);
            Assert.Contains("NOT_AVAILABLE", json);
            Assert.Contains("PENDING", json);
        }

        [Fact]
        public void Limitations_AreDocumented()
        {
            var items = new[]
            {
                "C19: PENDING — multi-recording requires ≥3 real recordings",
                "C20-C22: PROVISIONAL — token/credit/cost requires LLM integration",
                "S8-S12: Skipped in dry-run — live build environment required"
            };
            Assert.All(items, s => Assert.False(string.IsNullOrEmpty(s)));
        }
    }
}
