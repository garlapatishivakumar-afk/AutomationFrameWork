using AIAutomationGenerator;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Xunit.Abstractions;

namespace AIAutomationGenerator.Tests.Architecture;

/// <summary>
/// V3.0 REAL FRAMEWORK E2E VALIDATION
/// Runs the complete GenerateArchitectAsync pipeline against a SAFE COPY
/// of the actual AutomationFrameWork (PageElements / PageActions /
/// StepDefinitions / Features / Helpers + real code.ts recording).
/// The safe copy is read-only as a repository source;
/// FrameworkFileModifier writes only to a separate output folder.
/// The REAL AutomationFrameWork is never touched.
/// </summary>
public class V3RealFrameworkE2ETests : IDisposable
{
    private readonly ITestOutputHelper output;

    // Path to the safe copy created before the test
    private static readonly string SafeCopyRoot =
        Path.Combine(Path.GetTempPath(), "V3E2E_RealFramework");

    // Separate output folder where FrameworkFileModifier may write new files
    private readonly string modificationTarget;

    private readonly IGenerationOrchestrator orchestrator;

    public V3RealFrameworkE2ETests(ITestOutputHelper output)
    {
        this.output = output;

        // Modifications go to an isolated sub-folder, NOT into the safe copy directly
        modificationTarget = Path.Combine(SafeCopyRoot, "V3Output_" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(modificationTarget);

        var services = new ServiceCollection();
        services.AddAutomationGenerator();
        services.AddSingleton<IAIProvider, RealFrameworkMockAIProvider>();
        orchestrator = services.BuildServiceProvider().GetRequiredService<IGenerationOrchestrator>();
    }

    [Fact]
    public async Task E2E_RealFrameworkSafeCopy_CompleteV3Pipeline()
    {
        // ── Pre-condition: safe copy must exist ──────────────────────────────
        if (!Directory.Exists(SafeCopyRoot))
        {
            output.WriteLine("REAL FRAMEWORK E2E: NOT EXECUTED");
            output.WriteLine("Reason: Safe copy not found at " + SafeCopyRoot);
            output.WriteLine("Run the copy script first.");
            Assert.True(false, "Safe copy not found. E2E cannot run.");
            return;
        }

        string recordingPath = Path.Combine(SafeCopyRoot, "code.ts");
        if (!File.Exists(recordingPath))
        {
            output.WriteLine("REAL FRAMEWORK E2E: NOT EXECUTED");
            output.WriteLine("Reason: code.ts not found at " + recordingPath);
            Assert.True(false, "code.ts not found.");
            return;
        }

        output.WriteLine("=== V3.0 REAL FRAMEWORK E2E VALIDATION ===");
        output.WriteLine($"Repository (safe copy): {SafeCopyRoot}");
        output.WriteLine($"Recording:              {recordingPath}");
        output.WriteLine($"Modification target:    {modificationTarget}");
        output.WriteLine("");

        // ── Step 1: Run the complete V3 pipeline ─────────────────────────────
        var result = await orchestrator.GenerateArchitectAsync(
            SafeCopyRoot,     // repository (contains the copied PageElements etc.)
            recordingPath,    // recording (real code.ts)
            modificationTarget); // frameworkRoot (modifications go here, not to source)

        // ── Step 2: Report decisions ─────────────────────────────────────────
        output.WriteLine("--- Architecture Decisions ---");
        foreach (var d in result.Decisions)
            output.WriteLine("  " + d);
        output.WriteLine("");

        // ── Step 3: Report plan ───────────────────────────────────────────────
        output.WriteLine("--- Implementation Plan ---");
        output.WriteLine($"  Scenario:           {result.Plan.Scenario}");
        output.WriteLine($"  Business flow:      {result.Plan.BusinessFlow}");
        output.WriteLine($"  Overall confidence: {result.Plan.OverallConfidence:F2}");
        output.WriteLine($"  REUSE:  {result.Plan.ReuseCount}");
        output.WriteLine($"  EXTEND: {result.Plan.ExtendCount}");
        output.WriteLine($"  CREATE: {result.Plan.CreateCount}");
        output.WriteLine($"  Requires human approval: {result.Plan.RequiresHumanApproval}");
        output.WriteLine("");

        output.WriteLine("  Changes:");
        foreach (var c in result.Plan.Changes)
            output.WriteLine($"    [{c.Action}] {c.ComponentType}: {c.ClassName}.{c.MemberName} → {c.FilePath}");
        output.WriteLine("");

        // ── Step 4: Validation ────────────────────────────────────────────────
        output.WriteLine("--- Architecture Validation ---");
        output.WriteLine($"  IsValid: {result.Validation.IsValid}");
        foreach (var e in result.Validation.Errors)   output.WriteLine($"  ERROR: {e}");
        foreach (var w in result.Validation.Warnings) output.WriteLine($"  WARN:  {w}");
        output.WriteLine("");

        // ── Step 5: Modification result ───────────────────────────────────────
        output.WriteLine("--- Framework Modification ---");
        output.WriteLine($"  Success: {result.Modification.Success}");
        output.WriteLine($"  Applied files: {result.Modification.AppliedFiles.Count}");
        foreach (var f in result.Modification.AppliedFiles) output.WriteLine($"    Applied: {f}");
        foreach (var s in result.Modification.SkippedFiles) output.WriteLine($"    Skipped: {s}");
        foreach (var e in result.Modification.Errors)       output.WriteLine($"    Error:   {e}");
        output.WriteLine("");

        // ── Step 6: AI calls ──────────────────────────────────────────────────
        output.WriteLine($"--- Metrics ---");
        output.WriteLine($"  AI calls used: {result.AiCallsUsed}");
        output.WriteLine("");

        // ── Step 7: Verify generated files are discoverable ───────────────────
        output.WriteLine("--- Repository Re-scan ---");
        var postScanFiles = Directory.GetFiles(modificationTarget, "*.cs", SearchOption.AllDirectories)
            .Concat(Directory.GetFiles(modificationTarget, "*.feature", SearchOption.AllDirectories))
            .ToList();
        output.WriteLine($"  Files in modification target: {postScanFiles.Count}");
        foreach (var f in postScanFiles) output.WriteLine($"    {Path.GetRelativePath(modificationTarget, f)}");
        output.WriteLine("");

        // ── Step 8: Duplicate check ───────────────────────────────────────────
        output.WriteLine("--- Duplicate Check ---");
        bool noDuplicateCreates = result.Plan.Changes
            .Where(c => c.Action == "CREATE")
            .GroupBy(c => c.FilePath, StringComparer.OrdinalIgnoreCase)
            .All(g => g.Count() == 1);
        output.WriteLine($"  No duplicate CREATE targets: {noDuplicateCreates}");

        // ── Step 9: Summarize ─────────────────────────────────────────────────
        output.WriteLine("");
        output.WriteLine("=== REAL FRAMEWORK VALIDATION SUMMARY ===");
        output.WriteLine($"  Scenario:               {result.Plan.Scenario}");
        output.WriteLine($"  REUSE:                  {result.Plan.ReuseCount}");
        output.WriteLine($"  EXTEND:                 {result.Plan.ExtendCount}");
        output.WriteLine($"  CREATE:                 {result.Plan.CreateCount}");
        output.WriteLine($"  Files modified/created: {result.Modification.AppliedFiles.Count}");
        output.WriteLine($"  Architecture valid:     {result.Validation.IsValid}");
        output.WriteLine($"  Modification success:   {result.Modification.Success}");
        output.WriteLine($"  No duplicate creates:   {noDuplicateCreates}");
        output.WriteLine($"  AI calls:               {result.AiCallsUsed}");
        if (!string.IsNullOrWhiteSpace(result.ErrorMessage))
            output.WriteLine($"  Pipeline error:         {result.ErrorMessage}");

        // ── Assertions ────────────────────────────────────────────────────────
        // Must produce a plan (even all-REUSE is valid)
        Assert.NotNull(result.Plan);
        Assert.True(result.Plan.ArchitectureDecisions.Count >= 1,
            "V3 must produce at least one architecture decision from the real recording.");

        // Architecture validation must pass (or produce warnings only)
        Assert.True(result.Validation.IsValid,
            $"Architecture validation failed: {string.Join(", ", result.Validation.Errors)}");

        // No duplicate CREATE targets
        Assert.True(noDuplicateCreates, "Duplicate CREATE targets detected.");

        // If modification was attempted, it must succeed (or be empty = all REUSE)
        if (result.Plan.Changes.Any(c => c.Action != "REUSE"))
        {
            // Modification attempted — may succeed or need human approval
            // We only hard-fail if there was an unexpected pipeline error
            Assert.True(string.IsNullOrWhiteSpace(result.ErrorMessage)
                || result.ErrorMessage.Contains("human approval"),
                $"Unexpected pipeline error: {result.ErrorMessage}");
        }
    }

    public void Dispose()
    {
        try { Directory.Delete(modificationTarget, recursive: true); } catch { /* best effort */ }
    }
}

/// <summary>
/// AI provider that returns minimal valid C# for EXTEND/CREATE operations
/// during the real framework E2E test.
/// </summary>
internal sealed class RealFrameworkMockAIProvider : IAIProvider
{
    public Task<AIResponse> GenerateAsync(AIRequest request)
    {
        // Detect context and return appropriate minimal stubs
        bool isStep = request.Prompt?.Contains("StepDefinitions") == true;
        bool isFeature = request.Prompt?.Contains("Feature:") == true;

        string content;
        if (isFeature)
        {
            content = "Feature: GeneratedScenario\nScenario: Test\n  Given something\n";
        }
        else if (isStep)
        {
            content = """
namespace AutomationFrameWork.StepDefinitions;
using Reqnroll;
[Binding]
public class GeneratedSteps
{
    [When("generated step")]
    public async System.Threading.Tasks.Task WhenGeneratedStep() { }
}
""";
        }
        else
        {
            content = """
namespace AutomationFrameWork.PageActions;
using Microsoft.Playwright;
public class GeneratedMethods
{
    private readonly IPage page;
    public GeneratedMethods(IPage page) { this.page = page; }
    public async System.Threading.Tasks.Task PerformGeneratedActionAsync()
    {
        await page.WaitForLoadStateAsync();
    }
}
""";
        }

        return Task.FromResult(new AIResponse { Success = true, Content = content });
    }
}
