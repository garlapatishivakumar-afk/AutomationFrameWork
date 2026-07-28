using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IRetryPolicy
{
    Task<AIResponse> ExecuteAsync(
        Func<Task<AIResponse>> operation);
}