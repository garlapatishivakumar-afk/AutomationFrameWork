using AIAutomationGenerator.Business;
using AIAutomationGenerator.FrameworkScanner;
using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using System.Text.Json;

namespace AIAutomationGenerator.Generation;

public class GenerationOrchestrator : IGenerationOrchestrator
{
    private readonly IFrameworkScanner frameworkScanner;
    private readonly IFileGenerator fileGenerator;
    private readonly IContextBuilder contextBuilder;
    private readonly IContextFilter contextFilter;
    private readonly IMethodReuseEngine methodReuseEngine;
    private readonly ILocatorReuseEngine locatorReuseEngine;
    private readonly IStepReuseEngine stepReuseEngine;
    private readonly IPromptOptimizer promptOptimizer;
    private readonly IRecordingParser recordingParser;
    private readonly IBusinessFlowBuilder businessFlowBuilder;
    private readonly IPromptBuilder promptBuilder;
    private readonly IContextRankingService contextRankingService;
    private readonly IContextCacheService contextCacheService;
    private readonly IPromptOptimizationService promptOptimizationService;
    private readonly IAIResponseParser aiResponseParser;
    private readonly IScriptValidator scriptValidator;
    private readonly ILearningEngine learningEngine;
    private readonly IAIProvider aiProvider;

    public GenerationOrchestrator(
        IFrameworkScanner frameworkScanner,
        IFileGenerator fileGenerator,
        IContextBuilder contextBuilder,
        IContextFilter contextFilter,
        IMethodReuseEngine methodReuseEngine,
        ILocatorReuseEngine locatorReuseEngine,
        IStepReuseEngine stepReuseEngine,
        IContextRankingService contextRankingService,
        IPromptOptimizer promptOptimizer,
        IRecordingParser recordingParser,
        IBusinessFlowBuilder businessFlowBuilder,
        IPromptBuilder promptBuilder,
        IContextCacheService contextCacheService,
        IPromptOptimizationService promptOptimizationService,
        IAIResponseParser aiResponseParser,
        IScriptValidator scriptValidator,
        ILearningEngine learningEngine,
        IAIProvider aiProvider)
    {
        this.frameworkScanner = frameworkScanner;
        this.fileGenerator = fileGenerator;
        this.contextBuilder = contextBuilder;
        this.contextFilter = contextFilter;
        this.methodReuseEngine = methodReuseEngine;
        this.locatorReuseEngine = locatorReuseEngine;
        this.stepReuseEngine = stepReuseEngine;
        this.promptOptimizer = promptOptimizer;
        this.recordingParser = recordingParser;
        this.businessFlowBuilder = businessFlowBuilder;
        this.promptBuilder = promptBuilder;
        this.contextCacheService = contextCacheService;
        this.contextRankingService = contextRankingService;
        this.promptOptimizationService = promptOptimizationService;
        this.aiResponseParser = aiResponseParser;
        this.scriptValidator = scriptValidator;
        this.learningEngine = learningEngine;
        this.aiProvider = aiProvider;
    }

    public async Task GenerateAsync(string repositoryPath, string recordingPath, string outputFolder)
    {
        RepositoryMetadata metadata = await frameworkScanner.ScanAsync(repositoryPath);
        ContextModel context = contextBuilder.Build(metadata);

        var repositoryKnowledgeBuilder = new RepositoryKnowledgeBuilder();
        var repositoryGraphBuilder = new RepositoryGraphBuilder();
        var repositoryKnowledge = repositoryKnowledgeBuilder.Build(metadata);
        var repositoryGraph = repositoryGraphBuilder.Build(repositoryKnowledge);
        var contextRequest = new ContextRequest
        {
            FeatureName = metadata.Features.FirstOrDefault()?.Name ?? string.Empty,
            BusinessArea = metadata.Features.FirstOrDefault()?.BusinessArea ?? string.Empty
        };
        ContextPackage contextPackage;

        if (contextCacheService.Exists(repositoryPath))
        {
            contextPackage = await contextCacheService.LoadAsync(repositoryPath)
                             ?? contextBuilder.Build(repositoryGraph, contextRequest);
        }
        else
        {
            contextPackage = contextBuilder.Build(repositoryGraph, contextRequest);
            await contextCacheService.SaveAsync(repositoryPath, contextPackage);
        }

        contextPackage = contextRankingService.RankContext(
            contextPackage,
            contextRequest);

        contextPackage = promptOptimizationService.Optimize(contextPackage);

        var statistics = promptOptimizationService.Analyze(contextPackage);
        List<RecordingActionModel> actions = recordingParser.Parse(recordingPath);
        List<BusinessFlowModel> flows = businessFlowBuilder.Build(actions);

        ContextModel filteredContext = contextFilter.Filter(context, flows);
        List<MethodModel> methods = methodReuseEngine.FindReusableMethods(filteredContext, flows);
        List<LocatorModel> locators = locatorReuseEngine.FindReusableLocators(filteredContext, flows);
        List<StepDefinitionModel> steps = stepReuseEngine.FindReusableSteps(filteredContext, flows);

        PromptContext promptContext = promptOptimizer.Optimize(filteredContext, methods, locators, steps);
        List<QuestionModel> questions = new QuestionEngine().Generate(actions);
        PromptModel prompt = promptBuilder.Build(filteredContext, flows, questions);
        var request = new AIRequest
            {
                Prompt = prompt.Prompt
            };
        AIResponse aiResponse = await aiProvider.GenerateAsync(request);
        AIResponseModel parsed = aiResponseParser.Parse(aiResponse.Content);
        ValidationResult validation = scriptValidator.Validate(parsed.PageObjects);
        if (!validation.IsValid)
            {
                parsed.PageObjects =
                    scriptValidator.AutoFix(parsed.PageObjects);

                validation =
                    scriptValidator.Validate(parsed.PageObjects);
            }
        Directory.CreateDirectory(outputFolder);

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "Prompt.md"),
            BuildPromptMarkdown(prompt, promptContext, flows, questions));

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "FixedPageObjects.cs"),
            parsed.PageObjects);

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "AIResponse.txt"),
            aiResponse.Content);    

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "ValidationReport.txt"),
            string.Join(Environment.NewLine, validation.Errors));

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "FrameworkRules.md"),
            BuildFrameworkRulesMarkdown());

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "BusinessFlow.md"),
            BuildBusinessFlowMarkdown(flows));

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "ReusableMethods.md"),
            BuildReusableMethodsMarkdown(promptContext));

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "ReusableLocators.md"),
            BuildReusableLocatorsMarkdown(promptContext));

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "ReusableSteps.md"),
            BuildReusableStepsMarkdown(promptContext));

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "RepositorySummary.md"),
            BuildRepositorySummaryMarkdown(metadata));

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "Questions.md"),
            BuildQuestionsMarkdown(questions));

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "Context.json"),
            JsonSerializer.Serialize(filteredContext, new JsonSerializerOptions { WriteIndented = true }));

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "BusinessFlow.json"),
            JsonSerializer.Serialize(flows, new JsonSerializerOptions { WriteIndented = true }));

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "RepositoryMetadata.json"),
            JsonSerializer.Serialize(metadata, new JsonSerializerOptions { WriteIndented = true }));

        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "Recording.json"),
            JsonSerializer.Serialize(actions, new JsonSerializerOptions { WriteIndented = true }));
        
        await File.WriteAllTextAsync(
            Path.Combine(outputFolder, "AIResponse.txt"),
            aiResponse.Content);
        
        await fileGenerator.GenerateAsync(new GeneratedScript(), outputFolder);
       }

    private static string BuildPromptMarkdown(PromptModel prompt, PromptContext promptContext, List<BusinessFlowModel> flows, List<QuestionModel> questions)
    {
        return $"""
# Automation Generation Prompt

## Objective
Generate feature, page objects, methods, and step definitions for the following recorded Playwright flow.

## Business Flow
{JsonSerializer.Serialize(flows, new JsonSerializerOptions { WriteIndented = true })}

## Prompt
{prompt.Prompt}

## Optimized Context
- Features: {promptContext.Features.Count}
- Methods: {promptContext.Methods.Count}
- Locators: {promptContext.Locators.Count}
- Steps: {promptContext.Steps.Count}
- Utilities: {promptContext.Utilities.Count}
- Relationships: {promptContext.Relationships.Count}

## Questions
{string.Join(Environment.NewLine, questions.Select(x => $"- {x.Question} ({x.Target})"))}
""";
    }

    private static string BuildFrameworkRulesMarkdown()
    {
        return """
# Framework Rules

- Use Page Object Model.
- Reuse existing methods whenever possible.
- Reuse existing locators whenever possible.
- Do not duplicate code.
- Follow Reqnroll syntax.
- Generate Feature, PageObjects, Methods, and Steps.
""";
    }

    private static string BuildBusinessFlowMarkdown(List<BusinessFlowModel> flows)
    {
        var builder = new System.Text.StringBuilder();
        builder.AppendLine("# Business Flow");
        builder.AppendLine();

        foreach (var flow in flows)
        {
            builder.AppendLine($"## {flow.Name}");
            foreach (var action in flow.Actions)
            {
                builder.AppendLine($"- {action.ActionType}: {action.Target}");
            }
            builder.AppendLine();
        }

        return builder.ToString();
    }

    private static string BuildReusableMethodsMarkdown(PromptContext promptContext)
    {
        var builder = new System.Text.StringBuilder();
        builder.AppendLine("# Reusable Methods");
        builder.AppendLine();
        foreach (var method in promptContext.Methods)
        {
            builder.AppendLine($"- {method.Name}");
        }
        return builder.ToString();
    }

    private static string BuildReusableLocatorsMarkdown(PromptContext promptContext)
    {
        var builder = new System.Text.StringBuilder();
        builder.AppendLine("# Reusable Locators");
        builder.AppendLine();
        foreach (var locator in promptContext.Locators)
        {
            builder.AppendLine($"- {locator.Name}");
        }
        return builder.ToString();
    }

    private static string BuildReusableStepsMarkdown(PromptContext promptContext)
    {
        var builder = new System.Text.StringBuilder();
        builder.AppendLine("# Reusable Steps");
        builder.AppendLine();
        foreach (var step in promptContext.Steps)
        {
            builder.AppendLine($"- {step.StepText}");
        }
        return builder.ToString();
    }

    private static string BuildRepositorySummaryMarkdown(RepositoryMetadata metadata)
    {
        var builder = new System.Text.StringBuilder();
        builder.AppendLine("# Repository Summary");
        builder.AppendLine();
        builder.AppendLine($"- Features: {metadata.Features.Count}");
        builder.AppendLine($"- Methods: {metadata.Methods.Count}");
        builder.AppendLine($"- Locators: {metadata.Locators.Count}");
        builder.AppendLine($"- Steps: {metadata.Steps.Count}");
        builder.AppendLine($"- Utilities: {metadata.Utilities.Count}");
        return builder.ToString();
    }

    private static string BuildQuestionsMarkdown(List<QuestionModel> questions)
    {
        var builder = new System.Text.StringBuilder();
        builder.AppendLine("# Questions");
        builder.AppendLine();
        foreach (var question in questions)
        {
            builder.AppendLine($"- {question.Question} ({question.Target})");
        }
        return builder.ToString();
    }
}