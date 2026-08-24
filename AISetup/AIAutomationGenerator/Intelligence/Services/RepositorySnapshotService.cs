using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Safety;

namespace AIAutomationGenerator.Intelligence.Services
{
    public class RepositorySnapshotService
    {
        public RepositorySnapshot Create(
            string repositoryRoot,
            RepositoryKnowledgeModel repositoryKnowledge,
            string runId)
        {
            if (string.IsNullOrWhiteSpace(repositoryRoot))
            {
                throw new ArgumentException("Repository root cannot be empty.", nameof(repositoryRoot));
            }

            var files = GatherRelevantFiles(repositoryRoot, repositoryKnowledge)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(p => p, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var snapshotFiles = new List<RepositorySnapshotFile>();
            foreach (var relative in files)
            {
                var absolute = Path.Combine(repositoryRoot, relative.Replace('/', Path.DirectorySeparatorChar));
                if (!File.Exists(absolute))
                {
                    continue;
                }

                var bytes = File.ReadAllBytes(absolute);
                snapshotFiles.Add(new RepositorySnapshotFile
                {
                    RelativePath = ProtectedFilePolicy.Normalize(relative),
                    Length = bytes.LongLength,
                    Sha256 = ToSha256(bytes)
                });
            }

            var head = TryReadHead(repositoryRoot);
            var deterministicBody = BuildDeterministicBody(repositoryRoot, head, snapshotFiles);

            return new RepositorySnapshot
            {
                RunId = runId,
                RepositoryRoot = repositoryRoot,
                RepositoryHead = head,
                FileCount = snapshotFiles.Count,
                Files = snapshotFiles,
                SnapshotHash = ToSha256(Encoding.UTF8.GetBytes(deterministicBody)),
                SnapshotAtUtc = DateTime.UtcNow
            };
        }

        private static IEnumerable<string> GatherRelevantFiles(
            string repositoryRoot,
            RepositoryKnowledgeModel knowledge)
        {
            IEnumerable<string> ModelPaths(IEnumerable<string?> source) => source
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => ToRelative(repositoryRoot, p!));

            var fromModel = ModelPaths(knowledge.PageElements.Select(p => p.FilePath))
                .Concat(ModelPaths(knowledge.PageActions.Select(p => p.FilePath)))
                .Concat(ModelPaths(knowledge.StepDefinitions.Select(p => p.FilePath)))
                .Concat(ModelPaths(knowledge.Features.Select(f => f.FilePath)));

            var support = new[]
            {
                "Helpers",
                "Utilities",
                "Hooks",
                "DriverFactory",
                "config"
            };

            var supportFiles = support
                .Select(dir => Path.Combine(repositoryRoot, dir))
                .Where(Directory.Exists)
                .SelectMany(dir => Directory.EnumerateFiles(dir, "*", SearchOption.AllDirectories))
                .Select(path => ToRelative(repositoryRoot, path));

            var rootFiles = Directory
                .EnumerateFiles(repositoryRoot, "*", SearchOption.TopDirectoryOnly)
                .Where(path =>
                    path.EndsWith(".json", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".sln", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".slnf", StringComparison.OrdinalIgnoreCase));

            return fromModel
                .Concat(supportFiles)
                .Concat(rootFiles.Select(path => ToRelative(repositoryRoot, path)));
        }

        private static string BuildDeterministicBody(
            string repositoryRoot,
            string? head,
            IEnumerable<RepositorySnapshotFile> files)
        {
            var lines = files
                .OrderBy(f => f.RelativePath, StringComparer.Ordinal)
                .Select(f => $"{f.RelativePath}|{f.Length}|{f.Sha256}");

            return string.Join("\n", new[]
            {
                ProtectedFilePolicy.Normalize(Path.GetFullPath(repositoryRoot)),
                head ?? string.Empty,
                string.Join("\n", lines)
            });
        }

        private static string? TryReadHead(string repositoryRoot)
        {
            try
            {
                var gitDir = Path.Combine(repositoryRoot, ".git");
                if (!Directory.Exists(gitDir) && !File.Exists(gitDir))
                {
                    return null;
                }

                if (File.Exists(gitDir))
                {
                    var fileContent = File.ReadAllText(gitDir).Trim();
                    var actualGitDir = Path.GetFullPath(Path.Combine(repositoryRoot, fileContent.Replace("gitdir:", string.Empty).Trim()));
                    gitDir = actualGitDir;
                }

                var headFile = Path.Combine(gitDir, "HEAD");
                if (!File.Exists(headFile))
                {
                    return null;
                }

                var head = File.ReadAllText(headFile).Trim();
                if (!head.StartsWith("ref:", StringComparison.OrdinalIgnoreCase))
                {
                    return head;
                }

                var refPath = head.Replace("ref:", string.Empty).Trim();
                var refFile = Path.Combine(gitDir, refPath.Replace('/', Path.DirectorySeparatorChar));
                return File.Exists(refFile)
                    ? File.ReadAllText(refFile).Trim()
                    : head;
            }
            catch
            {
                return null;
            }
        }

        private static string ToRelative(string root, string filePath)
        {
            var full = Path.GetFullPath(filePath);
            return ProtectedFilePolicy.Normalize(Path.GetRelativePath(root, full));
        }

        private static string ToSha256(byte[] bytes)
        {
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(bytes));
        }
    }
}