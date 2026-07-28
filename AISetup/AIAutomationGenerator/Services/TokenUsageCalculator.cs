using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Services;

public class TokenUsageCalculator : ITokenUsageCalculator
{
    public AIUsageMetrics Calculate(
        AIConfiguration configuration,
        string prompt,
        string completion)
    {
        int promptTokens = prompt.Length / 4;
        int completionTokens = completion.Length / 4;

        return new AIUsageMetrics
        {
            Provider = configuration.Provider,
            Model = configuration.Model,
            PromptTokens = promptTokens,
            CompletionTokens = completionTokens,
            TotalTokens = promptTokens + completionTokens
        };
    }
}
