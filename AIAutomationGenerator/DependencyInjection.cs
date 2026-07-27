using AIAutomationGenerator.AI;
using AIAutomationGenerator.Business;
using AIAutomationGenerator.FrameworkScanner;
using AIAutomationGenerator.Generation;
using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Recording;
using AIAutomationGenerator.Shared;
using Microsoft.Extensions.DependencyInjection;

namespace AIAutomationGenerator;

public static class DependencyInjection
{
    public static IServiceCollection AddAutomationGenerator(
        this IServiceCollection services)
    {
        services.AddSingleton<IFileGenerator, FileGenerator>();
        services.AddSingleton<IGenerationOrchestrator, GenerationOrchestrator>();

        services.AddSingleton<IPromptBuilder, PromptBuilder>();
        services.AddSingleton<IPromptOptimizer, PromptOptimizer>();

        services.AddSingleton<IFrameworkScanner, SolutionScanner>();
        services.AddSingleton<IRepositoryIndexService, RepositoryIndexService>();
        services.AddSingleton<IRepositoryKnowledgeBuilder, RepositoryKnowledgeBuilder>();
        services.AddSingleton<IRepositoryGraphBuilder, RepositoryGraphBuilder>();
        services.AddSingleton<ILogger, ConsoleLogger>();
        services.AddSingleton<IContextBuilder, ContextBuilder>();
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
        services.AddSingleton<IAIProvider, MockAIProvider>();

        return services;
    }
}
