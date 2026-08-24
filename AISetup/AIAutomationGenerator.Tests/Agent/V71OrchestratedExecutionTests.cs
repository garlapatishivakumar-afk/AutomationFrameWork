using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using AIAutomationGenerator.Agent;
using AIAutomationGenerator.Orchestration;
using Xunit;

namespace AIAutomationGenerator.Tests.Agent
{
    public class V71OrchestratedExecutionTests
    {
        [Fact]
        public async Task NonDryRun_BuildFailure_ProducesRealS8ToS12Evidence()
        {
            var root = FindRepoRoot();
            if (root == null)
            {
                return;
            }

            var recording = Path.Combine(root, "AIRecorder", "code.ts");
            var badBuildProject = Path.Combine(root, "__missing_build_project__.csproj");
            var badTestProject = Path.Combine(root, "__missing_test_project__.csproj");

            var orchestrator = new V7MasterOrchestrator(
                root,
                buildProjectPath: badBuildProject,
                testProjectPath: badTestProject,
                maxSelfHealRetries: 1);

            var result = await orchestrator.RunAsync(recording, dryRun: false);

            var s8 = result.Stages.FirstOrDefault(s => s.StageName == "S8:Build");
            if (s8 == null)
            {
                var s5 = result.Stages.Single(s => s.StageName == "S5:CreateEngineeringPlan");
                Assert.False(s5.Succeeded);
                Assert.Equal("HumanReviewRequired", result.FinalStatus);
                return;
            }

            var s9 = result.Stages.Single(s => s.StageName == "S9:ExecuteTests");
            var s10 = result.Stages.Single(s => s.StageName == "S10:AnalyzeFailures");
            var s11 = result.Stages.Single(s => s.StageName == "S11:SelfHeal");
            var s12 = result.Stages.Single(s => s.StageName == "S12:Retest");

            Assert.False(s8.Succeeded);
            Assert.True(s9.Skipped);
            Assert.True(s10.Succeeded);
            Assert.False(s11.Succeeded);
            Assert.False(s12.Succeeded);

            Assert.NotNull(result.BuildResult);
            Assert.False(result.BuildResult!.Success);
            Assert.NotNull(result.FailureClassification);
            Assert.Equal(FailureCategory.Unknown, result.FailureClassification!.Category);
            Assert.Equal("HumanReviewRequired", result.FinalStatus);

            Assert.Empty(result.CorrectionAttempts);
            Assert.Empty(result.RetryResults);
            Assert.NotNull(result.HumanReviewReason);
        }

        [Fact]
        public async Task DryRun_S8ToS12RemainSkipped_AndNoLiveValidationArtifacts()
        {
            var root = FindRepoRoot();
            if (root == null)
            {
                return;
            }

            var recording = Path.Combine(root, "AIRecorder", "code.ts");
            var result = await new V7MasterOrchestrator(root).RunAsync(recording, dryRun: true);

            var staged = result.Stages
                .Where(s => s.StageName is "S8:Build" or "S9:ExecuteTests" or "S10:AnalyzeFailures" or "S11:SelfHeal" or "S12:Retest")
                .ToList();

            if (!staged.Any())
            {
                var s5 = result.Stages.Single(s => s.StageName == "S5:CreateEngineeringPlan");
                Assert.False(s5.Succeeded);
                Assert.Equal("HumanReviewRequired", result.FinalStatus);
                return;
            }

            Assert.Equal(5, staged.Count);
            Assert.All(staged, s => Assert.True(s.Skipped));
            Assert.Null(result.BuildResult);
            Assert.Null(result.TestResult);
            Assert.Null(result.FailureClassification);
        }

        private static string? FindRepoRoot()
        {
            var candidates = new[]
            {
                AppDomain.CurrentDomain.BaseDirectory,
                Environment.CurrentDirectory,
                Path.GetDirectoryName(typeof(V71OrchestratedExecutionTests).Assembly.Location)
            };

            foreach (var start in candidates)
            {
                if (start == null)
                {
                    continue;
                }

                var dir = new DirectoryInfo(start);
                while (dir != null)
                {
                    if (File.Exists(Path.Combine(dir.FullName, "AIRecorder", "code.ts")))
                    {
                        return dir.FullName;
                    }

                    dir = dir.Parent;
                }
            }

            return null;
        }
    }
}
