using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace AIAutomationGenerator.Safety
{
    /// <summary>
    /// Single authoritative protected-file policy shared by planning and execution.
    /// </summary>
    public class ProtectedFilePolicy
    {
        private readonly string? _repositoryRoot;

        private static readonly string[] ProtectedFileNames =
        {
            "Hooks.cs",
            "PlaywrightDriver.cs",
            "XunitAssembly.cs",
            "ImplicitUsings.cs",
            "appsettings.json",
            "reqnroll.json"
        };

        private static readonly string[] ProtectedExtensions =
        {
            ".csproj",
            ".sln",
            ".slnf",
            ".props",
            ".targets",
            ".yml",
            ".yaml"
        };

        private static readonly string[] ProtectedPathContains =
        {
            "/.github/workflows/",
            "/azure-pipelines/",
            "/.devcontainer/"
        };

        public ProtectedFilePolicy(string? repositoryRoot = null)
        {
            _repositoryRoot = repositoryRoot;
        }

        public bool IsProtected(string? filePath)
        {
            if (string.IsNullOrWhiteSpace(filePath))
            {
                return false;
            }

            var normalized = Normalize(filePath);
            var fileName = Path.GetFileName(normalized);

            if (ProtectedFileNames.Any(n => string.Equals(n, fileName, StringComparison.OrdinalIgnoreCase)))
            {
                return true;
            }

            if (ProtectedExtensions.Any(ext => normalized.EndsWith(ext, StringComparison.OrdinalIgnoreCase)))
            {
                return true;
            }

            return ProtectedPathContains.Any(token => normalized.Contains(token, StringComparison.OrdinalIgnoreCase));
        }

        public List<string> GetProtectedPaths()
        {
            if (string.IsNullOrWhiteSpace(_repositoryRoot) || !Directory.Exists(_repositoryRoot))
            {
                var defaults = new List<string>(ProtectedFileNames);
                defaults.AddRange(ProtectedExtensions.Select(ext => $"*{ext}"));
                defaults.AddRange(ProtectedPathContains);
                return defaults;
            }

            var matches = Directory
                .EnumerateFiles(_repositoryRoot, "*", SearchOption.AllDirectories)
                .Where(IsProtected)
                .Select(RelativeToRoot)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(p => p, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return matches;
        }

        private string RelativeToRoot(string absolutePath)
        {
            if (string.IsNullOrWhiteSpace(_repositoryRoot))
            {
                return Normalize(absolutePath);
            }

            try
            {
                var rel = Path.GetRelativePath(_repositoryRoot, absolutePath);
                return Normalize(rel);
            }
            catch
            {
                return Normalize(absolutePath);
            }
        }

        public static string Normalize(string path) =>
            path.Replace('\\', '/');
    }
}