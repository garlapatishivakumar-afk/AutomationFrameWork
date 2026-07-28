using System.Text.Json;
using AIAutomationGenerator;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AIAutomationGenerator.Tests;

public class GenerationPipelineTests : IDisposable
{
    private readonly string repositoryPath;
    private readonly string outputPath;
    private readonly string recordingPath;

    public GenerationPipelineTests()
    {
        repositoryPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString("N"));
        outputPath = Path.Combine(repositoryPath, "GeneratedOutput");
        recordingPath = Path.Combine(repositoryPath, "recording.ts");

        Directory.CreateDirectory(repositoryPath);
        SeedRepository(repositoryPath);
        SeedRecording(recordingPath);
    }

    [Fact]
    public async Task GenerateAsync_CreatesArtifacts_AndWritesVersionedCache()
    {
        ServiceCollection services = new();
        services.AddAutomationGenerator();
        services.AddSingleton<IAIProvider, TestAIProvider>();

        ServiceProvider provider = services.BuildServiceProvider();
        IGenerationOrchestrator orchestrator = provider.GetRequiredService<IGenerationOrchestrator>();

        await orchestrator.GenerateAsync(repositoryPath, recordingPath, outputPath);

        AssertGeneratedFile("Generated.feature");
        AssertGeneratedFile("PageObjects.cs");
        AssertGeneratedFile("Methods.cs");
        AssertGeneratedFile("StepDefinitions.cs");
        AssertGeneratedFile("Utilities.cs");
        AssertGeneratedFile("PromptOptimizationReport.md");

        string cacheFile = Path.Combine(repositoryPath, "ContextCache.json");
        Assert.True(File.Exists(cacheFile));

        string cacheJson = await File.ReadAllTextAsync(cacheFile);
        ContextPackage? cache = JsonSerializer.Deserialize<ContextPackage>(cacheJson);

        Assert.NotNull(cache);
        Assert.False(string.IsNullOrWhiteSpace(cache!.Fingerprint));
        Assert.Equal("2.0", cache.GeneratorVersion);
        Assert.NotEqual(default, cache.CreatedOn);
    }

    private void AssertGeneratedFile(string fileName)
    {
        string fullPath = Path.Combine(outputPath, fileName);
        Assert.True(File.Exists(fullPath));
        Assert.False(string.IsNullOrWhiteSpace(File.ReadAllText(fullPath)));
    }

    private static void SeedRepository(string path)
    {
        string feature = """
@area:Auth
Feature: Login

Scenario: Login works
Given user logs in
""";

        string code = """
using Reqnroll;

namespace Sample;

public class LoginPage
{
    public string LoginButton => "#login";

    [Given("user logs in")]
    public void UserLogsIn()
    {
        LoginButton.ToString();
    }
}
""";

        File.WriteAllText(Path.Combine(path, "Login.feature"), feature);
        File.WriteAllText(Path.Combine(path, "LoginPage.cs"), code);
    }

    private static void SeedRecording(string path)
    {
        string recording = """
await page.GetByRole("button", new() { Name = "Login" }).ClickAsync();
await page.Locator("#username").FillAsync("user1");
""";

        File.WriteAllText(path, recording);
    }

    public void Dispose()
    {
        if (Directory.Exists(repositoryPath))
        {
            Directory.Delete(repositoryPath, true);
        }
    }

    private sealed class TestAIProvider : IAIProvider
    {
        public Task<AIResponse> GenerateAsync(AIRequest request)
        {
            return Task.FromResult(new AIResponse
            {
                Success = true,
                Content = """
Feature File:
using System;
namespace Generated;
public class GeneratedFeature { }
Feature: Generated login flow
Scenario: Generated scenario

Page Objects:
using System;
namespace Generated;
public class LoginPage { public string LoginButton => "#login"; }

Methods:
using System;
namespace Generated;
public class LoginMethods { public void ClickLogin() { } }

Step Definitions:
using Reqnroll;
namespace Generated;
public class LoginSteps
{
    [Given("user logs in")]
    public void UserLogsIn() { }
}

Utilities:
using System;
namespace Generated;
public static class UtilityHelper { public static void Trace(string message) { } }

Validation Messages:
All good.
"""
            });
        }
    }
}
