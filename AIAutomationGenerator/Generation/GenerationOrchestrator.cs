using AIAutomationGenerator.Business;
using AIAutomationGenerator.AI;
using AIAutomationGenerator.FrameworkScanner;
using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using System.Globalization;
using System.Text.Json;

namespace AIAutomationGenerator.Generation;

public class GenerationOrchestrator : IGenerationOrchestrator
{
    private const string GeneratorVersion = "2.0";

    private readonly IFrameworkScanner frameworkScanner;
    private readonly IFileGenerator fileGenerator;
    private readonly IContextBuilder contextBuilder;
    private readonly IContextFingerprintService contextFingerprintService;
    private readonly IRepositoryKnowledgeBuilder repositoryKnowledgeBuilder;
    private readonly IRepositoryGraphBuilder repositoryGraphBuilder;
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
    private readonly IQuestionEngine questionEngine;
    private readonly IArtifactNamingService artifactNamingService;
    private readonly IAIResponseParser aiResponseParser;
    private readonly IScriptValidator scriptValidator;
    private readonly ILearningEngine learningEngine;
    private readonly IProviderFallbackService providerFallbackService;

    public GenerationOrchestrator(
        IFrameworkScanner frameworkScanner,
        IFileGenerator fileGenerator,
        IContextBuilder contextBuilder,
        IContextFingerprintService contextFingerprintService,
        IRepositoryKnowledgeBuilder repositoryKnowledgeBuilder,
        IRepositoryGraphBuilder repositoryGraphBuilder,
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
        IQuestionEngine questionEngine,
        IArtifactNamingService artifactNamingService,
        IAIResponseParser aiResponseParser,
        IScriptValidator scriptValidator,
        ILearningEngine learningEngine,
        IProviderFallbackService providerFallbackService)
    {
        this.frameworkScanner = frameworkScanner;
        this.fileGenerator = fileGenerator;
        this.contextBuilder = contextBuilder;
        this.contextFingerprintService = contextFingerprintService;
        this.repositoryKnowledgeBuilder = repositoryKnowledgeBuilder;
        this.repositoryGraphBuilder = repositoryGraphBuilder;
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
        this.questionEngine = questionEngine;
        this.artifactNamingService = artifactNamingService;
        this.aiResponseParser = aiResponseParser;
        this.scriptValidator = scriptValidator;
        this.learningEngine = learningEngine;
        this.providerFallbackService = providerFallbackService;
    }

    public async Task GenerateAsync(string repositoryPath, string recordingPath, string outputFolder)
    {
        try
        {
            RepositoryMetadata metadata = await frameworkScanner.ScanAsync(repositoryPath);
            ContextModel context = contextBuilder.Build(metadata);

            var repositoryKnowledge = repositoryKnowledgeBuilder.Build(metadata);
            var repositoryGraph = repositoryGraphBuilder.Build(repositoryKnowledge);
            string fingerprint = contextFingerprintService.GenerateFingerprint(
                metadata,
                repositoryPath,
                GeneratorVersion);

            var contextRequest = new ContextRequest
            {
                FeatureName = metadata.Features.FirstOrDefault()?.Name ?? string.Empty,
                BusinessArea = metadata.Features.FirstOrDefault()?.BusinessArea ?? string.Empty
            };
            ContextPackage contextPackage;

            if (contextCacheService.IsCacheValid(repositoryPath, fingerprint))
            {
                contextPackage = await contextCacheService.LoadAsync(repositoryPath)
                                 ?? contextBuilder.Build(repositoryGraph, contextRequest);
            }
            else
            {
                contextPackage = contextBuilder.Build(repositoryGraph, contextRequest);
                contextPackage.Fingerprint = fingerprint;
                contextPackage.GeneratorVersion = GeneratorVersion;
                contextPackage.CreatedOn = DateTime.UtcNow;
                await contextCacheService.SaveAsync(repositoryPath, contextPackage);
            }

            contextPackage.Fingerprint = fingerprint;
            contextPackage.GeneratorVersion = GeneratorVersion;
            if (contextPackage.CreatedOn == default)
            {
                contextPackage.CreatedOn = DateTime.UtcNow;
            }

            contextPackage = contextRankingService.RankContext(
                contextPackage,
                contextRequest);

            ContextPackage originalContextPackage = CloneContextPackage(contextPackage);
            contextPackage = promptOptimizationService.Optimize(contextPackage);

            PromptOptimizationStatistics optimizationStatistics =
                promptOptimizationService.CalculateStatistics(originalContextPackage, contextPackage);

            var statistics = promptOptimizationService.Analyze(contextPackage);
            List<RecordingActionModel> actions = recordingParser.Parse(recordingPath);
            List<BusinessFlowModel> flows = businessFlowBuilder.Build(actions);

            ContextModel filteredContext = contextFilter.Filter(context, flows);
            List<MethodModel> methods = methodReuseEngine.FindReusableMethods(filteredContext, flows);
            List<LocatorModel> locators = locatorReuseEngine.FindReusableLocators(filteredContext, flows);
            List<StepDefinitionModel> steps = stepReuseEngine.FindReusableSteps(filteredContext, flows);

            PromptContext promptContext = promptOptimizer.Optimize(filteredContext, methods, locators, steps);
            BusinessFlowModel selectedFlow = flows.FirstOrDefault() ?? new BusinessFlowModel();
            BusinessFlowDetectionResult detectedFlow = new()
            {
                FlowName = selectedFlow.Name,
                Verb = selectedFlow.Verb,
                Noun = selectedFlow.Noun,
                Confidence = selectedFlow.Confidence,
                Evidence = selectedFlow.Evidence.ToList(),
                Actions = selectedFlow.Actions.ToList()
            };

            ArtifactNamingResult naming = artifactNamingService.Generate(detectedFlow);
            List<QuestionModel> questions = questionEngine.Generate(detectedFlow.Actions);
            PromptModel prompt = promptBuilder is PromptBuilder concretePromptBuilder
                ? concretePromptBuilder.Build(filteredContext, detectedFlow, questions, naming)
                : promptBuilder.Build(filteredContext, detectedFlow, questions);

            prompt.FeatureFile = naming.FeatureFile;
            prompt.ObjectsFile = naming.ObjectsFile;
            prompt.MethodsFile = naming.MethodsFile;
            prompt.StepsFile = naming.StepsFile;
            prompt.FeatureClass = naming.FeatureName;
            prompt.ObjectsClass = naming.ObjectsClass;
            prompt.MethodsClass = naming.MethodsClass;
            prompt.StepsClass = naming.StepsClass;
            var request = new AIRequest
                {
                    Prompt = prompt.Prompt,
                    Context = promptContext,
                    BusinessFlows = flows
                };
            AIResponse aiResponse = await providerFallbackService.GenerateAsync(request);
            if (!aiResponse.Success)
            {
                throw new InvalidOperationException(
                    $"AI generation failed: {aiResponse.ErrorMessage}");
            }
            AIResponseModel parsed = aiResponseParser.Parse(aiResponse.Content);
            ValidationResult validation = scriptValidator.Validate(parsed.PageObjects);
            if (!validation.IsValid)
                {
                    parsed.PageObjects =
                        scriptValidator.AutoFix(parsed.PageObjects);

                    validation =
                        scriptValidator.Validate(parsed.PageObjects);
                }

            ValidationResult featureValidation = scriptValidator.Validate(parsed.FeatureFile);
            if (!featureValidation.IsValid)
            {
                parsed.FeatureFile = scriptValidator.AutoFix(parsed.FeatureFile);

                featureValidation = scriptValidator.Validate(parsed.FeatureFile);

                if (!featureValidation.IsValid)
                {
                    throw new InvalidOperationException(
                        "Generated Generated.feature failed validation.");
                }
            }

            ValidationResult methodsValidation = scriptValidator.Validate(parsed.Methods);
            if (!methodsValidation.IsValid)
            {
                parsed.Methods = scriptValidator.AutoFix(parsed.Methods);

                methodsValidation = scriptValidator.Validate(parsed.Methods);

                if (!methodsValidation.IsValid)
                {
                    throw new InvalidOperationException(
                        "Generated Methods.cs failed validation.");
                }
            }

            ValidationResult stepDefinitionsValidation = scriptValidator.Validate(parsed.StepDefinitions);
            if (!stepDefinitionsValidation.IsValid)
            {
                parsed.StepDefinitions = scriptValidator.AutoFix(parsed.StepDefinitions);

                stepDefinitionsValidation = scriptValidator.Validate(parsed.StepDefinitions);

                if (!stepDefinitionsValidation.IsValid)
                {
                    throw new InvalidOperationException(
                        "Generated StepDefinitions.cs failed validation.");
                }
            }

            ValidationResult utilitiesValidation = scriptValidator.Validate(parsed.Utilities);
            if (!utilitiesValidation.IsValid)
            {
                parsed.Utilities = scriptValidator.AutoFix(parsed.Utilities);

                utilitiesValidation = scriptValidator.Validate(parsed.Utilities);

                if (!utilitiesValidation.IsValid)
                {
                    throw new InvalidOperationException(
                        "Generated Utilities.cs failed validation.");
                }
            }

            Directory.CreateDirectory(outputFolder);

            await fileGenerator.GenerateAsync(parsed, outputFolder, metadata, repositoryPath);

            await AppendTokenChargeLogAsync(
                outputFolder,
                recordingPath,
                aiResponse,
                prompt,
                flows,
                questions,
                filteredContext,
                parsed);

            await File.WriteAllTextAsync(
                Path.Combine(outputFolder, "Prompt.md"),
                BuildPromptMarkdown(prompt, promptContext, flows, questions));

            await File.WriteAllTextAsync(
                Path.Combine(outputFolder, "PromptOptimizationReport.md"),
                BuildPromptOptimizationReportMarkdown(optimizationStatistics));

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
        }
        catch (InvalidOperationException ex)
        {
            throw new InvalidOperationException(
                $"Generation failed: {ex.Message}", ex);
        }
        catch (Exception ex)
        {
            throw new Exception(
                "Unexpected error occurred during AI generation pipeline.",
                ex);
        }
    }

    private static async Task AppendTokenChargeLogAsync(
        string outputFolder,
        string recordingPath,
        AIResponse aiResponse,
        PromptModel prompt,
        List<BusinessFlowModel> flows,
        List<QuestionModel> questions,
        ContextModel filteredContext,
        AIResponseModel parsed)
    {
        string tokenChargePath = Path.Combine(outputFolder, "Token charge");
        string scriptName = Path.GetFileName(recordingPath);
        string timestampUtc = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);

        int promptPromptTokensEstimated = EstimateTokenCount(prompt.Prompt);
        int businessFlowTokensEstimated = EstimateTokenCount(JsonSerializer.Serialize(flows));
        int questionsTokensEstimated = EstimateTokenCount(BuildQuestionsMarkdown(questions));
        int frameworkScanTokensEstimated = EstimateTokenCount(JsonSerializer.Serialize(filteredContext));

        int completionFeatureTokensEstimated = EstimateTokenCount(parsed.FeatureFile);
        int completionObjectsTokensEstimated = EstimateTokenCount(parsed.PageObjects);
        int completionMethodsTokensEstimated = EstimateTokenCount(parsed.Methods);
        int completionStepsTokensEstimated = EstimateTokenCount(parsed.StepDefinitions);

        int estimatedPromptTotal =
            promptPromptTokensEstimated +
            businessFlowTokensEstimated +
            questionsTokensEstimated +
            frameworkScanTokensEstimated;

        int estimatedCompletionTotal =
            completionFeatureTokensEstimated +
            completionObjectsTokensEstimated +
            completionMethodsTokensEstimated +
            completionStepsTokensEstimated;

        int estimatedTotal = estimatedPromptTotal + estimatedCompletionTotal;

        string provider = string.IsNullOrWhiteSpace(aiResponse.Usage.Provider)
            ? "Unknown"
            : aiResponse.Usage.Provider;

        string model = string.IsNullOrWhiteSpace(aiResponse.Usage.Model)
            ? "Unknown"
            : aiResponse.Usage.Model;

        int promptTokens = aiResponse.Usage.PromptTokens > 0
            ? aiResponse.Usage.PromptTokens
            : estimatedPromptTotal;

        int completionTokens = aiResponse.Usage.CompletionTokens > 0
            ? aiResponse.Usage.CompletionTokens
            : estimatedCompletionTotal;

        int totalTokens = aiResponse.Usage.TotalTokens > 0
            ? aiResponse.Usage.TotalTokens
            : promptTokens + completionTokens;

        decimal estimatedCost = aiResponse.Usage.EstimatedCost > 0
            ? aiResponse.Usage.EstimatedCost
            : 0m;

        if (!File.Exists(tokenChargePath))
        {
            string header = "TimestampUtc|ScriptName|Provider|Model|PromptTokens|CompletionTokens|TotalTokens|EstimatedCost";
            await File.WriteAllTextAsync(tokenChargePath, header + Environment.NewLine);
        }

        string entry = string.Join("|",
            timestampUtc,
            scriptName,
            provider,
            model,
            promptTokens.ToString(CultureInfo.InvariantCulture),
            completionTokens.ToString(CultureInfo.InvariantCulture),
            totalTokens.ToString(CultureInfo.InvariantCulture),
            estimatedCost.ToString(CultureInfo.InvariantCulture));

        string detailEntry = string.Join("|",
            "DETAIL",
            timestampUtc,
            scriptName,
            $"PromptMdTokensEst={promptPromptTokensEstimated}",
            $"BusinessFlowTokensEst={businessFlowTokensEstimated}",
            $"QuestionsTokensEst={questionsTokensEstimated}",
            $"FrameworkScanTokensEst={frameworkScanTokensEstimated}",
            $"FeatureTokensEst={completionFeatureTokensEstimated}",
            $"ObjectsTokensEst={completionObjectsTokensEstimated}",
            $"MethodsTokensEst={completionMethodsTokensEstimated}",
            $"StepsTokensEst={completionStepsTokensEstimated}",
            "Source=EstimatorFallbackWhenProviderUsageMissing");

        await File.AppendAllTextAsync(tokenChargePath, entry + Environment.NewLine + detailEntry + Environment.NewLine);

        string chargeSource = aiResponse.Usage.TotalTokens > 0
            ? "ProviderExact"
            : "EstimatedFallback";

        await AppendTokenChargeTableCsvAsync(
            outputFolder,
            timestampUtc,
            scriptName,
            provider,
            model,
            promptPromptTokensEstimated,
            businessFlowTokensEstimated,
            questionsTokensEstimated,
            frameworkScanTokensEstimated,
            completionFeatureTokensEstimated,
            completionObjectsTokensEstimated,
            completionMethodsTokensEstimated,
            completionStepsTokensEstimated,
            promptTokens,
            completionTokens,
            totalTokens,
            estimatedCost,
            chargeSource,
            prompt);
    }

    private static async Task AppendTokenChargeTableCsvAsync(
        string outputFolder,
        string timestampUtc,
        string scriptName,
        string provider,
        string model,
        int promptMdTokensEstimated,
        int businessFlowTokensEstimated,
        int questionsTokensEstimated,
        int frameworkScanTokensEstimated,
        int featureTokensEstimated,
        int objectsTokensEstimated,
        int methodsTokensEstimated,
        int stepsTokensEstimated,
        int promptTokens,
        int completionTokens,
        int totalTokens,
        decimal estimatedCost,
        string chargeSource,
        PromptModel prompt)
    {
        string tableCsvPath = Path.Combine(outputFolder, "Token charge details.csv");
        if (!File.Exists(tableCsvPath))
        {
            string csvHeader = "TimestampUtc,ScriptName,Category,Task,EstimatedTokens,Provider,Model,ChargeType,EstimatedCost";
            await File.WriteAllTextAsync(tableCsvPath, csvHeader + Environment.NewLine);
        }

        string featureFileName = string.IsNullOrWhiteSpace(prompt.FeatureFile) ? "Generated.feature" : prompt.FeatureFile;
        string objectsFileName = string.IsNullOrWhiteSpace(prompt.ObjectsFile) ? "GeneratedObjects.cs" : prompt.ObjectsFile;
        string methodsFileName = string.IsNullOrWhiteSpace(prompt.MethodsFile) ? "GeneratedMethods.cs" : prompt.MethodsFile;
        string stepsFileName = string.IsNullOrWhiteSpace(prompt.StepsFile) ? "GeneratedSteps.cs" : prompt.StepsFile;

        int promptTotalEstimated =
            promptMdTokensEstimated +
            businessFlowTokensEstimated +
            questionsTokensEstimated +
            frameworkScanTokensEstimated;

        int completionTotalEstimated =
            featureTokensEstimated +
            objectsTokensEstimated +
            methodsTokensEstimated +
            stepsTokensEstimated;

        int grandTotalEstimated = promptTotalEstimated + completionTotalEstimated;

        List<string> rows =
        [
            BuildCsvRow(timestampUtc, scriptName, "Prompt Tokens", "Reading/processing Prompt.md", promptMdTokensEstimated.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Prompt Tokens", "Analyzing BusinessFlow.json", businessFlowTokensEstimated.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Prompt Tokens", "Processing Questions.md", questionsTokensEstimated.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Prompt Tokens", "Scanning Existing Framework", frameworkScanTokensEstimated.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Total Prompt Tokens", string.Empty, promptTotalEstimated.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Completion Tokens", $"Generating {featureFileName}", featureTokensEstimated.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Completion Tokens", $"Generating {objectsFileName}", objectsTokensEstimated.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Completion Tokens", $"Generating {methodsFileName}", methodsTokensEstimated.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Completion Tokens", $"Generating {stepsFileName}", stepsTokensEstimated.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Total Completion Tokens", string.Empty, completionTotalEstimated.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Grand Total Tokens", "Prompt + Completion", grandTotalEstimated.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Provider Prompt Tokens", "Reported by provider", promptTokens.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Provider Completion Tokens", "Reported by provider", completionTokens.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Provider Total Tokens", "Reported by provider", totalTokens.ToString(CultureInfo.InvariantCulture), provider, model, chargeSource, string.Empty),
            BuildCsvRow(timestampUtc, scriptName, "Estimated Cost", "Model Approximation", string.Empty, provider, model, chargeSource, estimatedCost.ToString(CultureInfo.InvariantCulture))
        ];

        await File.AppendAllTextAsync(tableCsvPath, string.Join(Environment.NewLine, rows) + Environment.NewLine);
    }

    private static string BuildCsvRow(
        string timestampUtc,
        string scriptName,
        string category,
        string task,
        string estimatedTokens,
        string provider,
        string model,
        string chargeType,
        string estimatedCost)
    {
        string[] values =
        [
            timestampUtc,
            scriptName,
            category,
            task,
            estimatedTokens,
            provider,
            model,
            chargeType,
            estimatedCost
        ];

        return string.Join(",", values.Select(EscapeCsv));
    }

    private static string EscapeCsv(string? value)
    {
        string safeValue = value ?? string.Empty;
        if (safeValue.Contains('"'))
        {
            safeValue = safeValue.Replace("\"", "\"\"");
        }

        if (safeValue.Contains(',') || safeValue.Contains('"') || safeValue.Contains('\n') || safeValue.Contains('\r'))
        {
            return $"\"{safeValue}\"";
        }

        return safeValue;
    }

    private static int EstimateTokenCount(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return 0;
        }

        return Math.Max(1, content.Length / 4);
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

    private static ContextPackage CloneContextPackage(ContextPackage source)
    {
        ContextPackage clone = new()
        {
            Confidence = source.Confidence,
            Fingerprint = source.Fingerprint,
            GeneratorVersion = source.GeneratorVersion,
            CreatedOn = source.CreatedOn
        };

        foreach (ContextItem item in source.Items)
        {
            clone.Items.Add(new ContextItem
            {
                Type = item.Type,
                Name = item.Name,
                File = item.File,
                Score = item.Score
            });
        }

        return clone;
    }

    private static string BuildPromptOptimizationReportMarkdown(PromptOptimizationStatistics statistics)
    {
        return $"""
# Prompt Optimization Report

- Original Tokens: {statistics.OriginalTokens}
- Optimized Tokens: {statistics.OptimizedTokens}
- Tokens Removed: {statistics.TokensRemoved}
- Reduction: {statistics.OptimizationPercentage}%
""";
    }
}