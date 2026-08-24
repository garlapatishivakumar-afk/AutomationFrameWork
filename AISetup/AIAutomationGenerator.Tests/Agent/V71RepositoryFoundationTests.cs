using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using AIAutomationGenerator.Agent;
using AIAutomationGenerator.FrameworkScanner;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Intelligence.Services;
using Xunit;

namespace AIAutomationGenerator.Tests.Agent
{
    public class V71RepositoryFoundationTests
    {
        [Fact]
        public async Task RepositoryScan_FindsCoreFrameworkArtifacts()
        {
            var root = FindRepoRoot();
            if (root == null)
            {
                return;
            }

            var indexService = new FrameworkIndexService(root, new SolutionScanner());
            var index = await indexService.GetIndexAsync(forceRebuild: true);

            Assert.Contains(index.PageElements, e => e.FilePath.Contains("PageElements", StringComparison.OrdinalIgnoreCase));
            Assert.Contains(index.PageActions, a => a.FilePath.Contains("PageActions", StringComparison.OrdinalIgnoreCase));
            Assert.Contains(index.StepDefinitions, s => s.FilePath.Contains("StepDefinitions", StringComparison.OrdinalIgnoreCase));
        }

        [Fact]
        public void RepositorySnapshot_Hash_IsDeterministicForSameState()
        {
            var root = CreateSampleRepository();
            try
            {
                var model = new RepositoryKnowledgeModel
                {
                    RepositoryRoot = root,
                    PageElements = { new PageElementInfo { FilePath = Path.Combine(root, "PageElements", "SampleObjects.cs") } },
                    PageActions = { new PageActionInfo { FilePath = Path.Combine(root, "PageActions", "SampleMethods.cs") } },
                    StepDefinitions = { new StepDefinitionInfo { FilePath = Path.Combine(root, "StepDefinitions", "SampleSteps.cs") } }
                };

                var snapshotService = new RepositorySnapshotService();
                var s1 = snapshotService.Create(root, model, "run-1");
                var s2 = snapshotService.Create(root, model, "run-2");

                Assert.Equal(s1.SnapshotHash, s2.SnapshotHash);
                Assert.Equal(s1.FileCount, s2.FileCount);
            }
            finally
            {
                Directory.Delete(root, recursive: true);
            }
        }

        [Fact]
        public async Task V7Orchestrator_UsesRealRepositorySnapshot()
        {
            var root = FindRepoRoot();
            if (root == null)
            {
                return;
            }

            var recording = Path.Combine(root, "AIRecorder", "code.ts");
            var result = await new V7MasterOrchestrator(root).RunAsync(recording, dryRun: true);

            Assert.NotNull(result.RepositorySnapshot);
            Assert.True(result.RepositoryFileCount > 0);
            Assert.False(string.IsNullOrWhiteSpace(result.RepositorySnapshotHash));
            Assert.True(result.RepositorySnapshot!.Files.Any());
        }

        private static string? FindRepoRoot()
        {
            var candidates = new[]
            {
                AppDomain.CurrentDomain.BaseDirectory,
                Environment.CurrentDirectory,
                Path.GetDirectoryName(typeof(V71RepositoryFoundationTests).Assembly.Location)
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

        private static string CreateSampleRepository()
        {
            var root = Path.Combine(Path.GetTempPath(), "v71_repo_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(Path.Combine(root, "PageElements"));
            Directory.CreateDirectory(Path.Combine(root, "PageActions"));
            Directory.CreateDirectory(Path.Combine(root, "StepDefinitions"));
            Directory.CreateDirectory(Path.Combine(root, "Features"));

            File.WriteAllText(Path.Combine(root, "PageElements", "SampleObjects.cs"),
                "namespace Sample; public class SampleObjects { public string SearchButton => \"#search\"; }");
            File.WriteAllText(Path.Combine(root, "PageActions", "SampleMethods.cs"),
                "namespace Sample; public class SampleMethods { public void ClickSearchButton() { } }");
            File.WriteAllText(Path.Combine(root, "StepDefinitions", "SampleSteps.cs"),
                "using Reqnroll; namespace Sample; public class SampleSteps { [When(\"user clicks search\")] public void WhenUserClicksSearch() { } }");
            File.WriteAllText(Path.Combine(root, "Features", "Sample.feature"),
                "Feature: Sample\nScenario: Search\nWhen user clicks search\n");

            return root;
        }
    }
}
