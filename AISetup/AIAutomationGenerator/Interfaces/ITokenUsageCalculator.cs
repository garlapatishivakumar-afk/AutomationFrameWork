using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface ITokenUsageCalculator
{
    AIUsageMetrics Calculate(
        AIConfiguration configuration,
        string prompt,
        string completion);
}
