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

        // V3.0: --mode architect overrides; default is V2 generate mode
        string mode = args.Length > 0 && args.Contains("--mode")
            ? (Array.IndexOf(args, "--mode") + 1 < args.Length
                ? args[Array.IndexOf(args, "--mode") + 1]
                : "generate")
            : (runnerOptions.Mode ?? "generate");

        string repository = ResolvePath(
            runnerOptions.RepositoryPath,
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")));

        string recording = ResolvePath(
            runnerOptions.RecordingPath,
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "AIRecorder", "code.ts")));

        string output = ResolvePath(
            runnerOptions.OutputPath,
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "GeneratedOutput")));

        // V3.0: frameworkRoot defaults to repository root (the real AutomationFrameWork)
        string frameworkRoot = ResolvePath(
            runnerOptions.FrameworkRoot,
            repository);

        ServiceCollection services = new();

        services.AddAutomationGenerator();

        ServiceProvider provider = services.BuildServiceProvider();

        IAIHealthCheckService healthCheckService =
            provider.GetRequiredService<IAIHealthCheckService>();

        bool healthy =
            await healthCheckService.CheckAsync();

        if (!healthy)
        {
            Console.WriteLine("AI provider health check failed.");
            return;
        }

        IGenerationOrchestrator orchestrator =
            provider.GetRequiredService<IGenerationOrchestrator>();

        if (mode.Equals("architect", StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine("[V3] Running in Architect mode...");
            Console.WriteLine($"  Repository: {repository}");
            Console.WriteLine($"  Recording:  {recording}");
            Console.WriteLine($"  Framework:  {frameworkRoot}");

            var result = await orchestrator.GenerateArchitectAsync(repository, recording, frameworkRoot);

            Console.WriteLine("\n[V3] Architecture Decisions:");
            foreach (var d in result.Decisions)
                Console.WriteLine($"  {d}");

            Console.WriteLine($"\n[V3] Implementation Plan:");
            Console.WriteLine($"  REUSE:  {result.Plan.ReuseCount}");
            Console.WriteLine($"  EXTEND: {result.Plan.ExtendCount}");
            Console.WriteLine($"  CREATE: {result.Plan.CreateCount}");
            Console.WriteLine($"  Overall confidence: {result.Plan.OverallConfidence:F2}");

            Console.WriteLine($"\n[V3] Validation: {(result.Validation.IsValid ? "PASS" : "FAIL")}");
            foreach (var e in result.Validation.Errors) Console.WriteLine($"  ERROR: {e}");
            foreach (var w in result.Validation.Warnings) Console.WriteLine($"  WARN:  {w}");

            Console.WriteLine($"\n[V3] Framework Modification: {(result.Modification.Success ? "SUCCESS" : "FAILED")}");
            foreach (var f in result.Modification.AppliedFiles) Console.WriteLine($"  Applied: {f}");
            foreach (var e in result.Modification.Errors) Console.WriteLine($"  Error:   {e}");

            Console.WriteLine($"\n[V3] AI calls used: {result.AiCallsUsed}");

            if (!result.Success)
                Console.WriteLine($"\n[V3] FAILED: {result.ErrorMessage}");
            else
                Console.WriteLine("\n[V3] Architect mode completed successfully.");
        }
        else
        {
            await orchestrator.GenerateAsync(repository, recording, output);
            Console.WriteLine("Generation Completed.");
        }
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
        /// <summary>V3.0: root of the real Automation Framework. Defaults to RepositoryPath.</summary>
        public string? FrameworkRoot { get; set; }
        /// <summary>V3.0: "generate" (V2 default) or "architect" (V3 mode).</summary>
        public string? Mode { get; set; }
    }
}
