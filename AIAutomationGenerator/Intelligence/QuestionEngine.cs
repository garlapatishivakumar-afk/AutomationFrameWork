using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Intelligence;

public class QuestionEngine : IQuestionEngine
{
    public List<QuestionModel> Generate(List<RecordingActionModel> actions)
    {
        List<QuestionModel> questions = [];
        foreach (RecordingActionModel action in actions.OrderBy(a => a.Sequence))
        {
            if (action.ActionType == "Fill")
            {
                questions.Add(new QuestionModel
                {
                    Question = "Should this field use Excel data, Random data or Fixed data?",
                    ActionType = action.ActionType,
                    Target = string.IsNullOrWhiteSpace(action.LocatorValue)
                        ? action.Target
                        : action.LocatorValue,
                    IsMandatory = true
                });
            }
            if (action.ActionType == "Click")
            {
                questions.Add(new QuestionModel
                {
                    Question = "Should a success message or navigation be verified after this action?",
                    ActionType = action.ActionType,
                    Target = string.IsNullOrWhiteSpace(action.LocatorValue)
                        ? action.Target
                        : action.LocatorValue,
                    IsMandatory = false
                });
            }
        }
        return questions;
    }
}