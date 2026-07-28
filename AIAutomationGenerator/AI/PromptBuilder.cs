using System.Text;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class PromptBuilder : IPromptBuilder
{
    private readonly IPromptTemplateService templateService;

    public PromptBuilder(IPromptTemplateService templateService)
    {
        this.templateService = templateService;
    }

    public PromptModel Build(
        ContextModel context,
        List<BusinessFlowModel> flows,
        List<QuestionModel> questions)
    {
        string featureText = BuildFeaturesText(context.Features);
        string businessFlows = BuildBusinessFlowsText(flows);
        string methods = BuildMethodsText(context.Methods);
        string locators = BuildLocatorsText(context.Locators);
        string steps = BuildStepsText(context.Steps);
        string utilities = BuildUtilitiesText(context.Utilities);
        string rules = BuildRulesText(questions);

        string promptText = templateService.Render(
            "BasePrompt",
            new Dictionary<string, string>
            {
                ["Feature"] = featureText,
                ["BusinessFlows"] = businessFlows,
                ["Methods"] = methods,
                ["Locators"] = locators,
                ["Steps"] = steps,
                ["Utilities"] = utilities,
                ["Rules"] = rules
            });

        PromptModel prompt = new();
        prompt.Prompt = promptText;
        return prompt;
    }

    private static string BuildFeaturesText(List<FeatureModel> features)
    {
        if (features.Count == 0)
        {
            return "None";
        }

        StringBuilder builder = new();
        foreach (FeatureModel feature in features)
        {
            builder.AppendLine($"- {feature.Name}");
        }

        return builder.ToString().TrimEnd();
    }

    private static string BuildBusinessFlowsText(List<BusinessFlowModel> flows)
    {
        if (flows.Count == 0)
        {
            return "None";
        }

        StringBuilder builder = new();
        foreach (BusinessFlowModel flow in flows)
        {
            builder.AppendLine($"- {flow.Name}");
            foreach (RecordingActionModel action in flow.Actions)
            {
                builder.AppendLine($"  {action.Sequence}. {action.ActionType} : {action.Target}");
            }
        }

        return builder.ToString().TrimEnd();
    }

    private static string BuildMethodsText(List<MethodModel> methods)
    {
        if (methods.Count == 0)
        {
            return "None";
        }

        StringBuilder builder = new();
        foreach (MethodModel method in methods)
        {
            builder.AppendLine($"- {method.Name}");
        }

        return builder.ToString().TrimEnd();
    }

    private static string BuildLocatorsText(List<LocatorModel> locators)
    {
        if (locators.Count == 0)
        {
            return "None";
        }

        StringBuilder builder = new();
        foreach (LocatorModel locator in locators)
        {
            builder.AppendLine($"- {locator.Name}");
        }

        return builder.ToString().TrimEnd();
    }

    private static string BuildStepsText(List<StepDefinitionModel> steps)
    {
        if (steps.Count == 0)
        {
            return "None";
        }

        StringBuilder builder = new();
        foreach (StepDefinitionModel step in steps)
        {
            builder.AppendLine($"- {step.StepText}");
        }

        return builder.ToString().TrimEnd();
    }

    private static string BuildUtilitiesText(List<UtilityModel> utilities)
    {
        if (utilities.Count == 0)
        {
            return "None";
        }

        StringBuilder builder = new();
        foreach (UtilityModel utility in utilities)
        {
            builder.AppendLine($"- {utility.Name}");
        }

        return builder.ToString().TrimEnd();
    }

    private static string BuildRulesText(List<QuestionModel> questions)
    {
        StringBuilder builder = new();
        builder.AppendLine("- Use Page Object Model.");
        builder.AppendLine("- Reuse existing methods whenever possible.");
        builder.AppendLine("- Reuse existing locators whenever possible.");
        builder.AppendLine("- Do not duplicate code.");
        builder.AppendLine("- Follow Reqnroll syntax.");
        builder.AppendLine("- Generate Feature, PageObjects, Methods, and Steps.");

        if (questions.Count > 0)
        {
            builder.AppendLine("- Questions to consider:");
            foreach (QuestionModel question in questions)
            {
                builder.AppendLine($"  - {question.Question} ({question.Target})");
            }
        }

        return builder.ToString().TrimEnd();
    }
}