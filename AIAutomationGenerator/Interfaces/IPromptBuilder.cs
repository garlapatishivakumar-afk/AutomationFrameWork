using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IPromptBuilder
{
    PromptModel Build(
        ContextModel context,
    BusinessFlowDetectionResult flow,
        List<QuestionModel> questions);
}