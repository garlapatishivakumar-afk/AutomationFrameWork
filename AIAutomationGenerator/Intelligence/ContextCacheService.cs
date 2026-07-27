using System.Text.Json;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class ContextCacheService : IContextCacheService
{
    private const string CacheFileName = "ContextCache.json";

    public bool Exists(string repositoryPath)
    {
        return File.Exists(Path.Combine(repositoryPath, CacheFileName));
    }

    public async Task SaveAsync(string repositoryPath, ContextPackage context)
    {
        string file = Path.Combine(repositoryPath, CacheFileName);

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
}