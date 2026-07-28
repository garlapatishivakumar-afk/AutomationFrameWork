using System.Text.Json;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class ContextCacheService : IContextCacheService
{
    private const string CacheFileName = "ContextCache.json";
    private const string CurrentGeneratorVersion = "2.0";

    public bool IsCacheValid(string repositoryPath, string fingerprint)
    {
        string file = Path.Combine(repositoryPath, CacheFileName);
        ContextPackage? cache = LoadFromDisk(file);

        if (cache == null)
        {
            return false;
        }

        if (!string.Equals(cache.Fingerprint, fingerprint, StringComparison.Ordinal))
        {
            return false;
        }

        if (!string.Equals(cache.GeneratorVersion, CurrentGeneratorVersion, StringComparison.Ordinal))
        {
            return false;
        }

        if (cache.CreatedOn == default)
        {
            return false;
        }

        if (cache.CreatedOn.ToUniversalTime() < DateTime.UtcNow.AddHours(-24))
        {
            return false;
        }

        return true;
    }

    public async Task SaveAsync(string repositoryPath, ContextPackage context)
    {
        string file = Path.Combine(repositoryPath, CacheFileName);

        if (context.CreatedOn == default)
        {
            context.CreatedOn = DateTime.UtcNow;
        }

        var options = new JsonSerializerOptions
        {
            WriteIndented = true
        };

        string json = JsonSerializer.Serialize(context, options);

        await File.WriteAllTextAsync(file, json);
    }

    public async Task<ContextPackage?> LoadAsync(string repositoryPath)
    {
        string file = Path.Combine(repositoryPath, CacheFileName);

        if (!File.Exists(file))
            return null;

        string json = await File.ReadAllTextAsync(file);

        return JsonSerializer.Deserialize<ContextPackage>(json);
    }

    private static ContextPackage? LoadFromDisk(string filePath)
    {
        if (!File.Exists(filePath))
        {
            return null;
        }

        try
        {
            string json = File.ReadAllText(filePath);
            return JsonSerializer.Deserialize<ContextPackage>(json);
        }
        catch
        {
            return null;
        }
    }
}