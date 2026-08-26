using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using AIAutomationGenerator.Shared;

namespace AIAutomationGenerator.Optimization;

public interface IRepositoryDigestService
{
    string ComputeDigest(string repositoryPath);
}

public sealed class RepositoryDigestService : IRepositoryDigestService
{
    private readonly ConcurrentDictionary<string, string> _digestByFile = new(StringComparer.OrdinalIgnoreCase);
    private static readonly HashSet<string> IgnoredDirectories = new(StringComparer.OrdinalIgnoreCase)
    {
        ".git",
        "bin",
        "obj",
        "node_modules",
        "Reports",
        "Traces",
        "MetadataOutput",
        "GeneratedOutput"
    };

    private static readonly HashSet<string> IgnoredFiles = new(StringComparer.OrdinalIgnoreCase)
    {
        "frameworkIndex.json",
        "RepositoryIndex.json",
        "ContextCache.json"
    };

    public string ComputeDigest(string repositoryPath)
    {
        var hashes = new List<string>();

        foreach (var extension in new[] { "*.cs", "*.feature", "*.json", "*.ts", "*.csproj", "*.sln", "*.slnf" })
        {
            foreach (var file in FileHelper.GetFiles(repositoryPath, extension))
            {
                UsageTelemetryService.Current?.IncrementRepositoryFilesScanned();

                if (ShouldIgnore(file))
                {
                    continue;
                }

                string relative = Path.GetRelativePath(repositoryPath, file).Replace("\\", "/", StringComparison.Ordinal);
                long ticks = File.GetLastWriteTimeUtc(file).Ticks;

                if (!_digestByFile.TryGetValue(file, out var fileHash) || fileHash.StartsWith($"{ticks}:", StringComparison.Ordinal) == false)
                {
                    byte[] content = File.ReadAllBytes(file);
                    UsageTelemetryService.Current?.IncrementRepositoryFilesRead();
                    UsageTelemetryService.Current?.IncrementCacheMisses();
                    fileHash = $"{ticks}:{Convert.ToHexString(SHA256.HashData(content))}";
                    _digestByFile[file] = fileHash;
                }
                else
                {
                    UsageTelemetryService.Current?.IncrementCacheHits();
                }

                hashes.Add($"{relative}:{fileHash}");
            }
        }

        hashes.Sort(StringComparer.Ordinal);
        string joined = string.Join("\n", hashes);
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(joined)));
    }

    private static bool ShouldIgnore(string absolutePath)
    {
        string fileName = Path.GetFileName(absolutePath);
        if (IgnoredFiles.Contains(fileName))
        {
            return true;
        }

        string[] segments = absolutePath.Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        foreach (string segment in segments)
        {
            if (IgnoredDirectories.Contains(segment))
            {
                return true;
            }
        }

        return false;
    }
}