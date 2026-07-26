using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class QuestionEngine : IQuestionEngine
{
    public List<QuestionModel> Generate(List<RecordingActionModel> actions)
    {
        List<QuestionModel> questions = [];
        foreach (var action in actions)
        {
            if (action.ActionType == "Fill")
            {
                questions.Add(new QuestionModel
                {
                    Question = "Should this field use Excel data, Random data or Fixed data?",
                    ActionType = action.ActionType,
                    Target = action.Target,
                    IsMandatory = true
                });
            }
            if (action.ActionType == "Click")
            {
                questions.Add(new QuestionModel
                {
                    Question = "Should a success message or navigation be verified after this action?",
                    ActionType = action.ActionType,
                    Target = action.Target,
                    IsMandatory = false
                });
            }
        }
        return questions;
    }
}