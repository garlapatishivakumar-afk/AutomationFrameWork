using System;
using System.Collections.Concurrent;
using System.IO;
using System.Threading.Tasks;

namespace AIAutomationGenerator.Optimization;

public interface IFileContentCacheService
{
    string ReadAllText(string filePath);
    Task<string> ReadAllTextAsync(string filePath);
}

public sealed class FileContentCacheService : IFileContentCacheService
{
    private readonly ConcurrentDictionary<string, CacheEntry> _cache = new(StringComparer.OrdinalIgnoreCase);

    public string ReadAllText(string filePath)
    {
        long ticks = File.GetLastWriteTimeUtc(filePath).Ticks;
        if (_cache.TryGetValue(filePath, out var existing) && existing.LastWriteUtcTicks == ticks)
        {
            UsageTelemetryService.Current?.IncrementCacheHits();
            return existing.Content;
        }

        string content = File.ReadAllText(filePath);
        UsageTelemetryService.Current?.IncrementCacheMisses();
        UsageTelemetryService.Current?.IncrementRepositoryFilesRead();
        _cache[filePath] = new CacheEntry(ticks, content);
        return content;
    }

    public async Task<string> ReadAllTextAsync(string filePath)
    {
        long ticks = File.GetLastWriteTimeUtc(filePath).Ticks;
        if (_cache.TryGetValue(filePath, out var existing) && existing.LastWriteUtcTicks == ticks)
        {
            UsageTelemetryService.Current?.IncrementCacheHits();
            return existing.Content;
        }

        string content = await File.ReadAllTextAsync(filePath);
        UsageTelemetryService.Current?.IncrementCacheMisses();
        UsageTelemetryService.Current?.IncrementRepositoryFilesRead();
        _cache[filePath] = new CacheEntry(ticks, content);
        return content;
    }

    private sealed record CacheEntry(long LastWriteUtcTicks, string Content);
}