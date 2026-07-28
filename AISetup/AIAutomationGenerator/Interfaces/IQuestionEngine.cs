using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Interfaces;

public interface IQuestionEngine
{
    List<QuestionModel> Generate(List<RecordingActionModel> actions);
}