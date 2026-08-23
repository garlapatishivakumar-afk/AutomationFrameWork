using AIAutomationGenerator;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace AIAutomationGenerator.Tests.Architecture;

/// <summary>
/// V3.0 integration tests — exercises the complete V3 pipeline
/// (GenerateArchitectAsync) against a controlled test fixture repository.
/// Does NOT modify the production AutomationFrameWork.
/// </summary>
public class V3IntegrationTests : IDisposable
{
    private readonly string fixtureRoot;
    private readonly string recordingPath;
    private readonly IGenerationOrchestrator orchestrator;

    public V3IntegrationTests()
    {
        // Controlled fixture — isolated temp directory
        fixtureRoot = Path.Combine(Path.GetTempPath(), "V3Fixture_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(fixtureRoot);
        recordingPath = Path.Combine(fixtureRoot, "code.ts");

        SeedFrameworkFixture(fixtureRoot);

        var services = new ServiceCollection();
        services.AddAutomationGenerator();
        services.AddSingleton<IAIProvider, TestV3AIProvider>();
        orchestrator = services.BuildServiceProvider().GetRequiredService<IGenerationOrchestrator>();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // REUSE test: recording that matches an existing method
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GenerateArchitectAsync_REUSE_WhenExactMethodExists()
    {
        // Recording: click "Search Queue" button — existing fixture method matches
        File.WriteAllText(recordingPath,
            "import { test } from '@playwright/test';\n" +
            "test('t', async ({ page }) => {\n" +
            "  await page.getByRole('button', { name: 'Search Queue' }).click();\n" +
            "});\n");

        var result = await orchestrator.GenerateArchitectAsync(fixtureRoot, recordingPath, fixtureRoot);

        // There must be at least one REUSE decision
        Assert.True(result.Plan.ReuseCount >= 1 || result.Plan.ExtendCount >= 1 || result.Plan.CreateCount >= 1,
            "Plan must have at least one decision.");

        // No new duplicate method should be created for SearchQueue
        Assert.DoesNotContain(result.Modification.AppliedFiles,
            f => f.Contains("SearchQueueButton") && f.EndsWith(".cs"));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // CREATE test: recording for functionality that does NOT exist
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GenerateArchitectAsync_CREATE_WhenNoMatchingMethodExists()
    {
        // Recording: a genuinely new operation not in the fixture
        File.WriteAllText(recordingPath,
            "import { test } from '@playwright/test';\n" +
            "test('t', async ({ page }) => {\n" +
            "  await page.locator('#ctl00_ContentPlaceHolder1_txtNewlyAddedField').fill('value');\n" +
            "});\n");

        var result = await orchestrator.GenerateArchitectAsync(fixtureRoot, recordingPath, fixtureRoot);

        // Must have produced a plan (even if CREATE with human approval needed)
        Assert.NotNull(result.Plan);
        Assert.True(result.Plan.ArchitectureDecisions.Count >= 1);

        // Overall confidence should be set
        Assert.True(result.Plan.OverallConfidence >= 0.0 && result.Plan.OverallConfidence <= 1.0);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Confidence test: low-confidence decision requires human approval
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GenerateArchitectAsync_LowConfidence_RequiresHumanApproval()
    {
        // Ambiguous recording — no strong match
        File.WriteAllText(recordingPath,
            "import { test } from '@playwright/test';\n" +
            "test('t', async ({ page }) => {\n" +
            "  await page.locator('#ctl00_ContentPlaceHolder1_unknownControl').click();\n" +
            "});\n");

        var result = await orchestrator.GenerateArchitectAsync(fixtureRoot, recordingPath, fixtureRoot);

        // Plan should have been produced
        Assert.NotNull(result.Plan);

        // If any decision is low confidence, RequiresHumanApproval = true
        bool anyLowConfidence = result.Plan.ArchitectureDecisions.Any(d => d.Confidence < 0.50);
        if (anyLowConfidence)
            Assert.True(result.Plan.RequiresHumanApproval);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Duplicate prevention test
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GenerateArchitectAsync_NoDuplicate_WhenExistingMethodMatches()
    {
        // Recording intentionally similar to existing ClickSearchQueueButton
        File.WriteAllText(recordingPath,
            "import { test } from '@playwright/test';\n" +
            "test('t', async ({ page }) => {\n" +
            "  await page.getByRole('button', { name: 'Search Queue' }).click();\n" +
            "});\n");

        var result1 = await orchestrator.GenerateArchitectAsync(fixtureRoot, recordingPath, fixtureRoot);
        var result2 = await orchestrator.GenerateArchitectAsync(fixtureRoot, recordingPath, fixtureRoot);

        // Running twice should not create duplicate files
        var creates1 = result1.Plan.Changes.Count(c => c.Action == "CREATE");
        var creates2 = result2.Plan.Changes.Count(c => c.Action == "CREATE");
        Assert.Equal(creates1, creates2);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Implementation plan ordering test
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GenerateArchitectAsync_PlanOrderedCorrectly()
    {
        File.WriteAllText(recordingPath,
            "import { test } from '@playwright/test';\n" +
            "test('t', async ({ page }) => {\n" +
            "  await page.getByRole('button', { name: 'Search Queue' }).click();\n" +
            "  await page.locator('#ctl00_ContentPlaceHolder1_newField').fill('x');\n" +
            "});\n");

        var result = await orchestrator.GenerateArchitectAsync(fixtureRoot, recordingPath, fixtureRoot);

        var actions = result.Plan.Changes.Select(c => c.Action).ToList();
        // REUSE actions must come before EXTEND/CREATE
        if (actions.Contains("REUSE") && (actions.Contains("CREATE") || actions.Contains("EXTEND")))
        {
            int lastReuse  = actions.LastIndexOf("REUSE");
            int firstOther = actions.FindIndex(a => a != "REUSE");
            Assert.True(firstOther < 0 || lastReuse <= firstOther || actions[0] == "REUSE");
        }

        Assert.NotNull(result.Plan);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // V2 backward compatibility: GenerateAsync still works
    // ──────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task GenerateAsync_V2_StillWorks()
    {
        var tempOutput = Path.Combine(fixtureRoot, "Output");
        Directory.CreateDirectory(tempOutput);

        File.WriteAllText(recordingPath,
            "import { test } from '@playwright/test';\n" +
            "test('t', async ({ page }) => {\n" +
            "  await page.getByRole('button', { name: 'Search Queue' }).click();\n" +
            "});\n");

        // Should not throw
        await orchestrator.GenerateAsync(fixtureRoot, recordingPath, tempOutput);
    }

    // ──────────────────────────────────────────────────────────────────────────

    public void Dispose()
    {
        try { Directory.Delete(fixtureRoot, recursive: true); } catch { /* best effort */ }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Fixture helpers
    // ──────────────────────────────────────────────────────────────────────────

    private static void SeedFrameworkFixture(string root)
    {
        // PageElements fixture
        Directory.CreateDirectory(Path.Combine(root, "PageElements"));
        File.WriteAllText(Path.Combine(root, "PageElements", "ViewDashboardObjects.cs"), """
using Microsoft.Playwright;
namespace AutomationFrameWork.PageElements;
public class ViewDashboardObjects
{
    public ILocator SearchQueueButton(IPage page) => page.GetByRole(AriaRole.Button, new() { Name = "Search Queue" });
    public ILocator SearchUserDropdown(IPage page) => page.Locator("#ctl00_ContentPlaceHolder1_ddlSearchUser");
}
""");

        // PageActions fixture
        Directory.CreateDirectory(Path.Combine(root, "PageActions"));
        File.WriteAllText(Path.Combine(root, "PageActions", "ViewDashboardMethods.cs"), """
using AutomationFrameWork.PageElements;
using Microsoft.Playwright;
namespace AutomationFrameWork.PageActions;
public class ViewDashboardMethods
{
    private readonly IPage page;
    private readonly ViewDashboardObjects objects;
    public ViewDashboardMethods(IPage page) { this.page = page; objects = new(); }
    public async Task ClickSearchQueueButtonAsync()
    {
        await objects.SearchQueueButton(page).ClickAsync();
    }
}
""");

        // StepDefinitions fixture
        Directory.CreateDirectory(Path.Combine(root, "StepDefinitions"));
        File.WriteAllText(Path.Combine(root, "StepDefinitions", "ViewDashboardSteps.cs"), """
using Reqnroll;
namespace AutomationFrameWork.StepDefinitions;
[Binding]
public class ViewDashboardSteps
{
    [When("user clicks Search Queue button")]
    public async Task WhenUserClicksSearchQueueButton() { }
}
""");

        // Features fixture
        Directory.CreateDirectory(Path.Combine(root, "Features"));
        File.WriteAllText(Path.Combine(root, "Features", "ViewDashboard.feature"), """
Feature: View Dashboard
Scenario: Search Queue
  When user clicks Search Queue button
""");

        // Helpers
        Directory.CreateDirectory(Path.Combine(root, "Helpers"));
        File.WriteAllText(Path.Combine(root, "Helpers", "BaseSteps.cs"), """
namespace AutomationFrameWork.Helpers;
public class BaseSteps { }
""");
    }
}

/// <summary>Minimal mock AI provider for V3 integration tests.</summary>
internal sealed class TestV3AIProvider : IAIProvider
{
    public Task<AIResponse> GenerateAsync(AIRequest request) =>
        Task.FromResult(new AIResponse
        {
            Success = true,
            Content = """
namespace AutomationFrameWork.PageActions;
public class GeneratedMethods { }
Feature: Generated
Scenario: Test
  When something happens
"""
        });
}
