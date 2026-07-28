using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Services;

public class AIResponseCache : IAIResponseCache
{
    private readonly Dictionary<string, AIResponse> cache = new();

    private readonly object cacheLock = new();

    public bool TryGet(
        string key,
        out AIResponse response)
    {
        lock (cacheLock)
        {
            return cache.TryGetValue(key, out response!);
        }
    }

    public void Store(
        string key,
        AIResponse response)
    {
        lock (cacheLock)
        {
            cache[key] = response;
        }
    }
}
