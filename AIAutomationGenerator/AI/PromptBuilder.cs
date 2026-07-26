using System.Text;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class PromptBuilder : IPromptBuilder
{
    public PromptModel Build(
        ContextModel context,
        List<BusinessFlowModel> flows,
        List<QuestionModel> questions)
    {
        StringBuilder builder = new();
        builder.AppendLine("You are generating automation inside our framework.");
        builder.AppendLine();
        builder.AppendLine("Framework Rules:");
        builder.AppendLine("- Use Page Object Model.");
        builder.AppendLine("- Reuse existing methods whenever possible.");
        builder.AppendLine("- Reuse existing locators whenever possible.");
        builder.AppendLine("- Do not duplicate code.");
        builder.AppendLine("- Follow Reqnroll syntax.");
        builder.AppendLine("- Generate Feature, PageObjects, Methods, and Steps.");
        builder.AppendLine();
        builder.AppendLine("Business Flow:");
        foreach (BusinessFlowModel flow in flows)
        {
            builder.AppendLine($"- {flow.Name}");
            foreach (RecordingActionModel action in flow.Actions)
            {
                builder.AppendLine($"  {action.Sequence}. {action.ActionType} : {action.Target}");
            }
            builder.AppendLine();
        }

        builder.AppendLine("Existing reusable methods:");
        foreach (MethodModel method in context.Methods)
        {
            builder.AppendLine($"- {method.Name}");
        }

        builder.AppendLine();
        builder.AppendLine("Existing reusable locators:");
        foreach (LocatorModel locator in context.Locators)
        {
            builder.AppendLine($"- {locator.Name}");
        }

        builder.AppendLine();
        builder.AppendLine("Existing reusable step definitions:");
        foreach (StepDefinitionModel step in context.Steps)
        {
            builder.AppendLine($"- {step.StepText}");
        }

        builder.AppendLine();
        builder.AppendLine("Questions to consider:");
        foreach (QuestionModel question in questions)
        {
            builder.AppendLine($"- {question.Question} ({question.Target})");
        }

        PromptModel prompt = new();
        prompt.Prompt = builder.ToString();
        return prompt;
    }
}