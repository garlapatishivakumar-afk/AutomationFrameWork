using AIAutomationGenerator.AI;
using AIAutomationGenerator.Business;
using AIAutomationGenerator.FrameworkScanner;
using AIAutomationGenerator.Generation;
using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Recording;
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
        services.AddSingleton<IContextBuilder, ContextBuilder>();
        services.AddSingleton<IContextFilter, ContextFilter>();
        services.AddSingleton<IMethodSimilarityEngine, MethodSimilarityEngine>();
        services.AddSingleton<ILocatorSimilarityEngine, LocatorSimilarityEngine>();
        services.AddSingleton<IStepSimilarityEngine, StepSimilarityEngine>();
        services.AddSingleton<IMethodReuseEngine, MethodReuseEngine>();
        services.AddSingleton<ILocatorReuseEngine, LocatorReuseEngine>();
        services.AddSingleton<IStepReuseEngine, StepReuseEngine>();
        services.AddSingleton<IRecordingParser, RecordingParser>();
        services.AddSingleton<IBusinessFlowBuilder, BusinessFlowBuilder>();

        return services;
    }
}
