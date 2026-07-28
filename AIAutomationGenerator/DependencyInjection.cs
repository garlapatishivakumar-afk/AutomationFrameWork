using AIAutomationGenerator.AI;
using AIAutomationGenerator.Business;
using AIAutomationGenerator.Exporters;
using AIAutomationGenerator.FrameworkScanner;
using AIAutomationGenerator.Generation;
using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Recording;
using AIAutomationGenerator.Services;
using AIAutomationGenerator.Shared;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AIAutomationGenerator;

public static class DependencyInjection
{
    public static IServiceCollection AddAutomationGenerator(
        this IServiceCollection services)
    {
        services.AddSingleton<GeneratorOutputSettings>(_ =>
        {
            IConfigurationRoot configuration = new ConfigurationBuilder()
                .SetBasePath(AppContext.BaseDirectory)
                .AddJsonFile("appsettings.json", optional: true)
                .Build();

            GeneratorOutputSettings settings = new();
            configuration.GetSection("GeneratorOutput").Bind(settings);
            return settings;
        });

        services.AddSingleton<IFileGenerator, FileGenerator>();
        services.AddSingleton<IGenerationOrchestrator, GenerationOrchestrator>();

        services.AddSingleton<AIProviderSettings>(_ =>
        {
            IConfigurationRoot configuration = new ConfigurationBuilder()
                .SetBasePath(AppContext.BaseDirectory)
                .AddJsonFile("appsettings.json", optional: true)
                .Build();

            AIProviderSettings settings = new();
            configuration.GetSection("AIProvider").Bind(settings);

            if (string.IsNullOrWhiteSpace(settings.Provider))
            {
                AIConfiguration legacy = new();
                configuration.GetSection("AI").Bind(legacy);

                settings.Provider = string.IsNullOrWhiteSpace(legacy.Provider)
                    ? "Mock"
                    : legacy.Provider;
                settings.ApiKey = legacy.ApiKey;
                settings.Model = legacy.Model;
                settings.Endpoint = legacy.BaseUrl;
            }

            return settings;
        });

        services.AddSingleton<IAIConfigurationValidator, AIConfigurationValidator>();
        services.AddSingleton<IAIConfigurationProvider, AIConfigurationProvider>();
        services.AddSingleton<IAIHealthCheckService, AIHealthCheckService>();
        services.AddSingleton<OpenAIRequestSerializer>();
        services.AddSingleton<GeminiRequestSerializer>();
        services.AddSingleton<AzureOpenAIRequestSerializer>();
        services.AddSingleton<IAIRequestSerializerFactory, AIRequestSerializerFactory>();
        services.AddSingleton<OpenAIResponseDeserializer>();
        services.AddSingleton<GeminiResponseDeserializer>();
        services.AddSingleton<AzureOpenAIResponseDeserializer>();
        services.AddSingleton<IAIResponseDeserializerFactory, AIResponseDeserializerFactory>();
        services.AddSingleton<IRetryPolicy, RetryPolicy>();
        services.AddSingleton<IAIMetricsService, AIMetricsService>();
        services.AddSingleton<IAIMetricsPersistence, JsonMetricsPersistence>();
        services.AddSingleton<IAIReportService, AIReportService>();
        services.AddSingleton<IAIResponseCache, AIResponseCache>();
        services.AddSingleton<ICacheKeyGenerator, CacheKeyGenerator>();
        services.AddSingleton<ITokenUsageCalculator, TokenUsageCalculator>();
        services.AddSingleton<IProviderFallbackService, ProviderFallbackService>();
        services.AddHttpClient<IAIClient, AIHttpClient>();
        services.AddSingleton<IAIRequestBuilder, AIRequestBuilder>();
        services.AddSingleton<IAIResponseProcessor, AIResponseProcessor>();
        services.AddSingleton<IPromptBuilder, PromptBuilder>();
        services.AddSingleton<IPromptTemplateService, PromptTemplateService>();
        services.AddSingleton<IPromptOptimizer, PromptOptimizer>();
        services.AddSingleton<IPromptContextBuilder, PromptContextBuilder>();
        services.AddSingleton<IQuestionEngine, QuestionEngine>();

        services.AddSingleton<IFrameworkScanner, SolutionScanner>();
        services.AddSingleton<IFeatureParser, FeatureParser>();
        services.AddSingleton<IMethodParser, MethodParser>();
        services.AddSingleton<ILocatorParser, LocatorParser>();
        services.AddSingleton<IStepDefinitionParser, StepDefinitionParser>();
        services.AddSingleton<IUtilityParser, UtilityParser>();
        services.AddSingleton<IMetadataExporter, MetadataExporter>();
        services.AddSingleton<IRelationshipBuilder, RelationshipBuilder>();
        services.AddSingleton<IRepositoryScanner, FeatureScanner>();
        services.AddSingleton<IRepositoryScanner, MethodScanner>();
        services.AddSingleton<IRepositoryScanner, LocatorScanner>();
        services.AddSingleton<IRepositoryScanner, StepDefinitionScanner>();
        services.AddSingleton<IRepositoryScanner, UtilityScanner>();
        services.AddSingleton<IRepositoryIndexService, RepositoryIndexService>();
        services.AddSingleton<IRepositoryKnowledgeBuilder, RepositoryKnowledgeBuilder>();
        services.AddSingleton<IRepositoryGraphBuilder, RepositoryGraphBuilder>();
        services.AddSingleton<ILogger, ConsoleLogger>();
        services.AddSingleton<IContextBuilder, ContextBuilder>();
        services.AddSingleton<IContextFingerprintService, ContextFingerprintService>();
        services.AddSingleton<IContextCacheService, ContextCacheService>();
        services.AddSingleton<IContextRankingService, ContextRankingService>();
        services.AddSingleton<IPromptOptimizationService, PromptOptimizationService>();
        services.AddSingleton<IContextFilter, ContextFilter>();
        services.AddSingleton<IAIResponseParser, AIResponseParser>();
        services.AddSingleton<IScriptValidator, ScriptValidator>();
        services.AddSingleton<ILearningEngine, LearningEngine>();
        services.AddSingleton<IMethodSimilarityEngine, MethodSimilarityEngine>();
        services.AddSingleton<ILocatorSimilarityEngine, LocatorSimilarityEngine>();
        services.AddSingleton<IStepSimilarityEngine, StepSimilarityEngine>();
        services.AddSingleton<IMethodReuseEngine, MethodReuseEngine>();
        services.AddSingleton<ILocatorReuseEngine, LocatorReuseEngine>();
        services.AddSingleton<IStepReuseEngine, StepReuseEngine>();
        services.AddSingleton<IRecordingParser, RecordingParser>();
        services.AddSingleton<IBusinessFlowBuilder, BusinessFlowBuilder>();

        services.AddSingleton<OpenAIProvider>();
        services.AddSingleton<GeminiProvider>();
        services.AddSingleton<AzureOpenAIProvider>();
        services.AddSingleton<MockAIProvider>();
        services.AddSingleton<IAIProviderFactory, AIProviderFactory>();
        services.AddSingleton<IAIProvider>(sp =>
            sp.GetRequiredService<IAIProviderFactory>().Create());

        return services;
    }
}
