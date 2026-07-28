using System.Text;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.AI;

public class PromptBuilder : IPromptBuilder
{
    private readonly IPromptTemplateService templateService;
    private readonly IArtifactNamingService artifactNamingService;

    public PromptBuilder(
        IPromptTemplateService templateService,
        IArtifactNamingService artifactNamingService)
    {
        this.templateService = templateService;
        this.artifactNamingService = artifactNamingService;
    }

    public PromptModel Build(
        ContextModel context,
        BusinessFlowDetectionResult flow,
        List<QuestionModel> questions)
    {
        ArtifactNamingResult artifacts = artifactNamingService.Generate(flow);
        return Build(context, flow, questions, artifacts);
    }

    public PromptModel Build(
        ContextModel context,
        BusinessFlowDetectionResult flow,
        List<QuestionModel> questions,
        ArtifactNamingResult artifacts)
    {
        string featureText = BuildFeatureText(flow);
        string businessPurpose = BuildBusinessPurpose(flow);
        string detectedFlow = BuildDetectedFlow(flow);
        string businessFlows = BuildBusinessFlowsText(flow);
        string generatedArtifacts = BuildGeneratedArtifactsText(artifacts);
        string methods = BuildMethodsText(context.Methods);
        string locators = BuildLocatorsText(context.Locators);
        string steps = BuildStepsText(context.Steps);
        string utilities = BuildUtilitiesText(context.Utilities);
        string rules = BuildRulesText(flow, artifacts, questions);

        string promptText = templateService.Render(
            "BasePrompt",
            new Dictionary<string, string>
            {
                ["Feature"] = featureText,
                ["BusinessPurpose"] = businessPurpose,
                ["DetectedFlow"] = detectedFlow,
                ["BusinessFlows"] = businessFlows,
                ["GeneratedArtifacts"] = generatedArtifacts,
                ["Methods"] = methods,
                ["Locators"] = locators,
                ["Steps"] = steps,
                ["Utilities"] = utilities,
                ["Rules"] = rules
            });

        PromptModel prompt = new();
        prompt.Prompt = promptText;
        prompt.FeatureFile = artifacts.FeatureFile;
        prompt.ObjectsFile = artifacts.ObjectsFile;
        prompt.MethodsFile = artifacts.MethodsFile;
        prompt.StepsFile = artifacts.StepsFile;
        prompt.FeatureClass = artifacts.FeatureName;
        prompt.ObjectsClass = artifacts.ObjectsClass;
        prompt.MethodsClass = artifacts.MethodsClass;
        prompt.StepsClass = artifacts.StepsClass;
        return prompt;
    }

    private static string BuildGeneratedArtifactsText(ArtifactNamingResult artifacts)
    {
        StringBuilder builder = new();
        builder.AppendLine($"Feature File: {artifacts.FeatureFile}");
        builder.AppendLine($"Objects File: {artifacts.ObjectsFile}");
        builder.AppendLine($"Methods File: {artifacts.MethodsFile}");
        builder.AppendLine($"Steps File: {artifacts.StepsFile}");

        return builder.ToString().TrimEnd();
    }

    private static string BuildFeatureText(BusinessFlowDetectionResult flow)
    {
        if (flow is null || string.IsNullOrWhiteSpace(flow.FlowName))
        {
            return "None";
        }

        return flow.FlowName;
    }

    private static string BuildBusinessPurpose(BusinessFlowDetectionResult flow)
    {
        if (flow is null)
        {
            return "None";
        }

        if (!string.IsNullOrWhiteSpace(flow.Verb) && !string.IsNullOrWhiteSpace(flow.Noun))
        {
            return $"{flow.Verb} {flow.Noun}";
        }

        if (!string.IsNullOrWhiteSpace(flow.FlowName))
        {
            return flow.FlowName;
        }

        return "None";
    }

    private static string BuildDetectedFlow(BusinessFlowDetectionResult flow)
    {
        if (flow is null)
        {
            return "None";
        }

        StringBuilder builder = new();
        builder.AppendLine($"- Flow Name: {Safe(flow.FlowName)}");
        builder.AppendLine($"- Verb: {Safe(flow.Verb)}");
        builder.AppendLine($"- Business Object: {Safe(flow.Noun)}");
        builder.AppendLine($"- Confidence: {(flow.Confidence * 100):0.##}%");
        builder.AppendLine("- Evidence:");

        if (flow.Evidence.Count == 0)
        {
            builder.AppendLine("  - None");
        }
        else
        {
            foreach (string evidence in flow.Evidence)
            {
                builder.AppendLine($"  - {evidence}");
            }
        }

        return builder.ToString().TrimEnd();
    }

    private static string BuildBusinessFlowsText(BusinessFlowDetectionResult flow)
    {
        if (flow is null || flow.Actions.Count == 0)
        {
            return "None";
        }

        StringBuilder builder = new();
        builder.AppendLine($"- {Safe(flow.FlowName)}");
        foreach (RecordingActionModel action in flow.Actions)
        {
            builder.AppendLine($"  {action.Sequence}. {action.ActionType} : {action.Target}");
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

    private static string BuildRulesText(
        BusinessFlowDetectionResult flow,
        ArtifactNamingResult artifacts,
        List<QuestionModel> questions)
    {
        StringBuilder builder = new();
        builder.AppendLine("- Use Page Object Model.");
        builder.AppendLine("- Reuse existing methods whenever possible.");
        builder.AppendLine("- Reuse existing locators whenever possible.");
        builder.AppendLine("- Do not duplicate code.");
        builder.AppendLine("- Follow Reqnroll syntax.");
        builder.AppendLine("- Generate exactly these files:");
        builder.AppendLine($"  - {artifacts.FeatureFile}");
        builder.AppendLine($"  - {artifacts.ObjectsFile}");
        builder.AppendLine($"  - {artifacts.MethodsFile}");
        builder.AppendLine($"  - {artifacts.StepsFile}");

        if (flow is not null && flow.Actions.Count > 0)
        {
            builder.AppendLine("- Ensure actions are generated in recorded sequence:");
            foreach (RecordingActionModel action in flow.Actions)
            {
                builder.AppendLine($"  - {action.Sequence}. {action.ActionType} on {action.Target}");
            }
        }

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

    private static string Safe(string value)
    {
        return string.IsNullOrWhiteSpace(value)
            ? "None"
            : value;
    }
}