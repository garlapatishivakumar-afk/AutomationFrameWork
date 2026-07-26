using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IPromptBuilder
{
    PromptModel Build(
        ContextModel context,
        List<BusinessFlowModel> flows,
        List<QuestionModel> questions);
}