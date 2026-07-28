using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IAIResponseCache
{
    bool TryGet(
        string key,
        out AIResponse response);

    void Store(
        string key,
        AIResponse response);
}
