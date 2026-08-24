using System.Text.Json;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.FrameworkScanner;

public class RepositoryIndexService : IRepositoryIndexService
{
    private readonly ILogger logger;
    private static readonly SemaphoreSlim IndexWriteLock = new(1, 1);
    private static readonly HashSet<string> IgnoredDirectories = new(StringComparer.OrdinalIgnoreCase)
    {
        ".git",
        "bin",
        "obj",
        "Reports",
        "Traces",
        "MetadataOutput",
        "GeneratedOutput",
        "node_modules"
    };

    public RepositoryIndexService(ILogger logger)
    {
        this.logger = logger;
    }

    public async Task<RepositoryMetadata> GetOrBuildAsync(string repositoryPath, Func<Task<RepositoryMetadata>> buildMetadata)
    {
        if (string.IsNullOrWhiteSpace(repositoryPath))
        {
            throw new ArgumentException("Repository path cannot be empty.", nameof(repositoryPath));
        }

        string indexFilePath = Path.Combine(repositoryPath, "RepositoryIndex.json");
        if (File.Exists(indexFilePath) && !HasRepositoryChanged(repositoryPath, indexFilePath))
        {
            logger.LogInformation("Loading cached repository index.");
            return await LoadFromFileAsync(indexFilePath);
        }

        logger.LogInformation("Building repository index.");
        RepositoryMetadata metadata = await buildMetadata();
        await SaveToFileAsync(indexFilePath, metadata);
        return metadata;
    }

    private bool HasRepositoryChanged(string repositoryPath, string indexFilePath)
    {
        if (!File.Exists(indexFilePath))
        {
            return true;
        }

        string fingerprint = BuildFingerprint(repositoryPath);
        string cachedFingerprint = LoadFingerprint(indexFilePath);
        return !string.Equals(fingerprint, cachedFingerprint, StringComparison.Ordinal);
    }

    private string BuildFingerprint(string repositoryPath)
    {
        List<string> entries = new();
        foreach (string file in EnumerateRelevantFiles(repositoryPath))
        {
            FileInfo fileInfo = new(file);
            entries.Add($"{file}|{fileInfo.Length}|{fileInfo.LastWriteTimeUtc:O}");
        }

        return string.Join("\n", entries.OrderBy(entry => entry, StringComparer.Ordinal));
    }

    private static string LoadFingerprint(string indexFilePath)
    {
        try
        {
            string json = File.ReadAllText(indexFilePath);
            return JsonSerializer.Deserialize<RepositoryIndexDocument>(json)?.Fingerprint ?? string.Empty;
        }
        catch (Exception)
        {
            return string.Empty;
        }
    }

    private IEnumerable<string> EnumerateRelevantFiles(string directory)
    {
        if (!Directory.Exists(directory))
        {
            yield break;
        }

        foreach (string file in Directory.EnumerateFiles(directory))
        {
            if (ShouldIgnore(file))
            {
                continue;
            }

            yield return file;
        }

        foreach (string subDirectory in Directory.EnumerateDirectories(directory))
        {
            string folderName = Path.GetFileName(subDirectory);
            if (IgnoredDirectories.Contains(folderName))
            {
                continue;
            }

            foreach (string file in EnumerateRelevantFiles(subDirectory))
            {
                yield return file;
            }
        }
    }

    private static bool ShouldIgnore(string path)
    {
        string fileName = Path.GetFileName(path);
        string directoryName = Path.GetDirectoryName(path) is string dir ? Path.GetFileName(dir) : string.Empty;
        return string.Equals(fileName, "RepositoryIndex.json", StringComparison.OrdinalIgnoreCase)
            || IgnoredDirectories.Contains(directoryName)
            || string.Equals(fileName, ".gitignore", StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<RepositoryMetadata> LoadFromFileAsync(string indexFilePath)
    {
        string json = await File.ReadAllTextAsync(indexFilePath);
        RepositoryIndexDocument? document = JsonSerializer.Deserialize<RepositoryIndexDocument>(json);
        return document?.Metadata ?? new RepositoryMetadata();
    }

    private async Task SaveToFileAsync(string indexFilePath, RepositoryMetadata metadata)
    {
        await IndexWriteLock.WaitAsync();
        try
        {
        string directory = Path.GetDirectoryName(indexFilePath) ?? string.Empty;
        Directory.CreateDirectory(directory);

        RepositoryIndexDocument document = new()
        {
            Metadata = metadata,
            Fingerprint = BuildFingerprint(Path.GetDirectoryName(indexFilePath) ?? string.Empty)
        };

        JsonSerializerOptions options = new()
        {
            WriteIndented = true
        };

        string json = JsonSerializer.Serialize(document, options);
        string tempFile = Path.Combine(directory, $"{Path.GetFileName(indexFilePath)}.{Guid.NewGuid():N}.tmp");
        await File.WriteAllTextAsync(tempFile, json);

        if (File.Exists(indexFilePath))
        {
            File.Delete(indexFilePath);
        }

        File.Move(tempFile, indexFilePath);
        }
        finally
        {
            IndexWriteLock.Release();
        }
    }

    private sealed class RepositoryIndexDocument
    {
        public RepositoryMetadata? Metadata { get; set; }
        public string Fingerprint { get; set; } = string.Empty;
    }
}
