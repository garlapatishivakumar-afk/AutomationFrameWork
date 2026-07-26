using AIAutomationGenerator.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AIAutomationGenerator.Runner;

internal class Program
{
    static async Task Main(string[] args)
    {
        IConfigurationRoot configuration = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json", optional: true, reloadOnChange: false)
            .Build();

        RunnerOptions runnerOptions = configuration
            .GetSection("Runner")
            .Get<RunnerOptions>() ?? new RunnerOptions();

        string repository = ResolvePath(
            runnerOptions.RepositoryPath,
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..")));

        string recording = ResolvePath(
            runnerOptions.RecordingPath,
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "Helpers", "CommonActionsPage.cs")));

        string output = ResolvePath(
            runnerOptions.OutputPath,
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "GeneratedOutput")));

        ServiceCollection services = new();

        services.AddAutomationGenerator();

        ServiceProvider provider = services.BuildServiceProvider();

        IGenerationOrchestrator orchestrator =
            provider.GetRequiredService<IGenerationOrchestrator>();

        await orchestrator.GenerateAsync(
            repository,
            recording,
            output);

        Console.WriteLine("Generation Completed.");
    }

    private static string ResolvePath(string? configuredPath, string fallbackPath)
    {
        if (!string.IsNullOrWhiteSpace(configuredPath))
        {
            return Path.IsPathRooted(configuredPath)
                ? configuredPath
                : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, configuredPath));
        }

        return fallbackPath;
    }

    private sealed class RunnerOptions
    {
        public string? RepositoryPath { get; set; }
        public string? RecordingPath { get; set; }
        public string? OutputPath { get; set; }
    }
}
