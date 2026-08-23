using AIAutomationGenerator;
using AIAutomationGenerator.Architecture;
using AIAutomationGenerator.Business;
using AIAutomationGenerator.FrameworkScanner;
using AIAutomationGenerator.Intelligence;
using AIAutomationGenerator.Interfaces;
using AIAutomationGenerator.Models;
using AIAutomationGenerator.Recording;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Xunit.Abstractions;

namespace AIAutomationGenerator.Tests.Architecture;

/// <summary>
/// V3.1 REAL CODEGEN VALIDATION — Read-Only.
/// Runs the real AIRecorder/code.ts recording through the V3.1 pipeline against
/// a read-only scan of the actual AutomationFrameWork. No production files are modified.
/// </summary>
public class V31RealCodegenValidationTests
{
    private readonly ITestOutputHelper output;

    // Real production framework path (read-only scan)
    // Bin path: ...\AISetup\AIAutomationGenerator.Tests\bin\Debug\net8.0
    //           → 5 levels up → AutomationFrameWork root
    private static readonly string RealFrameworkRoot =
        Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..", ".."));

    // Real Codegen recording
    private static readonly string RealRecordingPath =
        Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..", "..", "AIRecorder", "code.ts"));

    public V31RealCodegenValidationTests(ITestOutputHelper output)
    {
        this.output = output;
    }

    [Fact]
    public async Task V31_RealCodegen_FullPipelineValidation_ReadOnly()
    {
        output.WriteLine("=== V3.1 REAL CODEGEN VALIDATION ===");
        output.WriteLine($"  Framework root:  {RealFrameworkRoot}");
        output.WriteLine($"  Recording path:  {RealRecordingPath}");
        output.WriteLine("");

        // ── Pre-conditions ───────────────────────────────────────────────────
        if (!File.Exists(RealRecordingPath))
        {
            output.WriteLine("SKIP: code.ts not found at expected path.");
            output.WriteLine($"  Expected: {RealRecordingPath}");
            return; // Not a failure — recording may not be present in all environments
        }

        output.WriteLine("=== STEP 1: RecordingParser ===");
        var parser  = new RecordingParser();
        var actions = parser.Parse(RealRecordingPath);

        output.WriteLine($"  Total parsed actions: {actions.Count}");
        foreach (var a in actions)
        {
            output.WriteLine($"  [{a.Sequence:D2}] ActionType={a.ActionType,-10} " +
                             $"LocatorType={a.LocatorType,-10} " +
                             $"LocatorArgument='{a.LocatorArgument}' " +
                             $"LocatorValue='{a.LocatorValue}' " +
                             $"PageName='{a.PageName}'");
            output.WriteLine($"        Target='{a.Target?.Trim()}'");
        }
        output.WriteLine("");

        Assert.NotEmpty(actions);

        // ── Step 2: BusinessFlowDetector ─────────────────────────────────────
        output.WriteLine("=== STEP 2: BusinessFlowDetector ===");
        var services = new ServiceCollection();
        services.AddAutomationGenerator();
        var provider = services.BuildServiceProvider();
        var flowBuilder = provider.GetRequiredService<IBusinessFlowBuilder>();
        var flows = flowBuilder.Build(actions);

        output.WriteLine($"  Total flows detected: {flows.Count}");
        foreach (var f in flows)
        {
            output.WriteLine($"  Flow: '{f.Name}'  Actions: {f.Actions.Count}");
            foreach (var fa in f.Actions)
                output.WriteLine($"    [{fa.Sequence}] {fa.ActionType} / {fa.LocatorType} / PageName='{fa.PageName}'");
        }
        output.WriteLine("");

        Assert.NotEmpty(flows);

        // ── Step 3: RepositoryScanner (read-only) ────────────────────────────
        output.WriteLine("=== STEP 3: RepositoryIndexService + SolutionScanner (read-only) ===");
        var scanner  = new SolutionScanner();
        var metadata = await scanner.ScanAsync(RealFrameworkRoot);

        output.WriteLine($"  Methods scanned:    {metadata.Methods.Count}");
        output.WriteLine($"  Locators scanned:   {metadata.Locators.Count}");
        output.WriteLine($"  Steps scanned:      {metadata.Steps.Count}");
        output.WriteLine($"  Features scanned:   {metadata.Features.Count}");
        output.WriteLine($"  Utilities scanned:  {metadata.Utilities.Count}");
        output.WriteLine($"  Relationships:      {metadata.Relationships.Count}");
        output.WriteLine("");

        output.WriteLine("  --- Locators in PageElements ---");
        foreach (var l in metadata.Locators.Take(20))
            output.WriteLine($"    {l.PageName}.{l.Name}  [{l.LocatorType}]  selector='{l.Selector?.Trim()}'  file={Path.GetFileName(l.FilePath)}");
        if (metadata.Locators.Count > 20) output.WriteLine($"    ... ({metadata.Locators.Count - 20} more)");
        output.WriteLine("");

        output.WriteLine("  --- Steps in StepDefinitions ---");
        foreach (var s in metadata.Steps.Take(20))
            output.WriteLine($"    {Path.GetFileNameWithoutExtension(s.FilePath)}.{s.MethodName}  text='{s.StepText}'");
        if (metadata.Steps.Count > 20) output.WriteLine($"    ... ({metadata.Steps.Count - 20} more)");
        output.WriteLine("");

        output.WriteLine("  --- Methods in PageActions ---");
        foreach (var m in metadata.Methods.Where(m =>
            m.FilePath.Contains("PageActions", StringComparison.OrdinalIgnoreCase)).Take(20))
            output.WriteLine($"    {m.ClassName}.{m.Name}  async={m.IsAsync}");
        output.WriteLine("");

        // ── Step 4: ArchitectureDecisionEngine (V3.1) ────────────────────────
        output.WriteLine("=== STEP 4: V3.1 ArchitectureDecisionEngine ===");
        var knowledgeBuilder = provider.GetRequiredService<IRepositoryKnowledgeBuilder>();
        var knowledge = knowledgeBuilder.Build(metadata);

        var decisionEngine = new ArchitectureDecisionEngine();
        var decisions = decisionEngine.Decide(flows, knowledge, metadata);

        output.WriteLine($"  Total decisions: {decisions.Count}");
        output.WriteLine("");

        // Group by layer for clarity
        foreach (var layerGroup in decisions.GroupBy(d => d.ComponentType).OrderBy(g => g.Key))
        {
            output.WriteLine($"  --- {layerGroup.Key} ---");
            foreach (var d in layerGroup)
            {
                output.WriteLine($"  [{d.Decision,-6}] conf={d.Confidence:F2}  {d.TargetComponent}.{d.ExistingMemberName}");
                output.WriteLine($"           file:   '{d.TargetFile}'");
                output.WriteLine($"           reason: {d.Reason}");
                if (d.Evidence.Any()) output.WriteLine($"           evidence: {string.Join(", ", d.Evidence.Select(Path.GetFileName))}");
                output.WriteLine($"           human-approval: {d.RequiresHumanApproval}");
            }
            output.WriteLine("");
        }

        // ── Step 5: Summary of PageName signals ─────────────────────────────
        output.WriteLine("=== STEP 5: PageName signal analysis ===");
        output.WriteLine("  (Critical for StepDefinitions EXTEND/CREATE detection)");
        var allActions = flows.SelectMany(f => f.Actions).ToList();
        var meaningfulPageNames = allActions
            .Where(a => !string.IsNullOrWhiteSpace(a.PageName) && a.PageName.Any(char.IsUpper))
            .Select(a => a.PageName)
            .Distinct()
            .ToList();
        var plainPageNames = allActions
            .Where(a => !string.IsNullOrWhiteSpace(a.PageName) && !a.PageName.Any(char.IsUpper))
            .Select(a => a.PageName)
            .Distinct()
            .ToList();

        output.WriteLine($"  Meaningful PageNames (has uppercase): [{string.Join(", ", meaningfulPageNames)}]");
        output.WriteLine($"  Plain PageNames (all lowercase):      [{string.Join(", ", plainPageNames)}]");
        output.WriteLine("");

        // ── Step 6: ImplementationPlanner ───────────────────────────────────
        output.WriteLine("=== STEP 6: ImplementationPlanner ===");
        var layerMapper = new FrameworkLayerMapper();
        var planner = new ImplementationPlanner(layerMapper);
        var plan = planner.CreatePlan(flows, decisions, metadata, RealFrameworkRoot);

        output.WriteLine($"  Scenario:           {plan.Scenario}");
        output.WriteLine($"  Overall confidence: {plan.OverallConfidence:F2}");
        output.WriteLine($"  REUSE count:        {plan.ReuseCount}");
        output.WriteLine($"  EXTEND count:       {plan.ExtendCount}");
        output.WriteLine($"  CREATE count:       {plan.CreateCount}");
        output.WriteLine($"  Requires approval:  {plan.RequiresHumanApproval}");
        output.WriteLine($"  Affected files:     {plan.AffectedFiles.Count}");
        output.WriteLine("");
        output.WriteLine("  --- Ordered changes ---");
        foreach (var c in plan.Changes)
        {
            output.WriteLine($"  [{c.Action,-6}] {c.ComponentType,-18} {c.ClassName}.{c.MemberName}");
            output.WriteLine($"           file: '{c.FilePath}'");
        }
        output.WriteLine("");

        // ── Step 7: ArchitectureValidator ────────────────────────────────────
        output.WriteLine("=== STEP 7: ArchitectureValidator ===");
        var scriptValidator = provider.GetRequiredService<IScriptValidator>();
        var validator = new ArchitectureValidator(scriptValidator);
        var validation = validator.ValidatePlan(plan, RealFrameworkRoot);

        output.WriteLine($"  IsValid: {validation.IsValid}");
        foreach (var e in validation.Errors)   output.WriteLine($"  ERROR: {e}");
        foreach (var w in validation.Warnings) output.WriteLine($"  WARN:  {w}");
        output.WriteLine("");

        // ── Step 8: Limitation analysis ──────────────────────────────────────
        output.WriteLine("=== STEP 8: LIMITATION ANALYSIS ===");

        // L1: PageName from Playwright Codegen
        bool allActionsHavePlainPageName = allActions.All(a => a.PageName == "page");
        output.WriteLine($"  [L1] All actions have PageName='page' (Codegen default): {allActionsHavePlainPageName}");
        if (allActionsHavePlainPageName)
        {
            output.WriteLine("       LIMITATION: RecordingParser sets PageName to the JS variable name ('page').");
            output.WriteLine("       This means StepDefinitions EXTEND/CREATE requires meaningful PageName.");
            output.WriteLine("       StepDefinitions REUSE still works via MethodName/StepText matching.");
            output.WriteLine("       Affected: EvaluateStepLayer() EXTEND/CREATE paths.");
            output.WriteLine("       Component: RecordingParser (V3.x) or ArchitectureDecisionEngine (infer from locator file).");
        }

        // L2: Locator matching
        var getByRoleActions = allActions
            .Where(a => a.LocatorType == "getByRole" || (a.Target?.Contains("getByRole") == true))
            .ToList();
        output.WriteLine($"  [L2] getByRole actions (require name: extraction): {getByRoleActions.Count}");

        // L3: Locator decisions produced
        var pageElementsDecisions = decisions.Where(d => d.ComponentType == "PageElements").ToList();
        var reuseLocators = pageElementsDecisions.Count(d => d.Decision == ReuseDecisionType.Reuse);
        var extendLocators = pageElementsDecisions.Count(d => d.Decision == ReuseDecisionType.Extend);
        var createLocators = pageElementsDecisions.Count(d => d.Decision == ReuseDecisionType.Create);
        output.WriteLine($"  [L3] PageElements decisions: REUSE={reuseLocators}, EXTEND={extendLocators}, CREATE={createLocators}");

        // L4: Step decisions produced
        var stepDecisions = decisions.Where(d => d.ComponentType == "StepDefinitions").ToList();
        var reuseSteps  = stepDecisions.Count(d => d.Decision == ReuseDecisionType.Reuse);
        var extendSteps = stepDecisions.Count(d => d.Decision == ReuseDecisionType.Extend);
        var createSteps = stepDecisions.Count(d => d.Decision == ReuseDecisionType.Create);
        output.WriteLine($"  [L4] StepDefinitions decisions: REUSE={reuseSteps}, EXTEND={extendSteps}, CREATE={createSteps}");
        output.WriteLine("");

        // ── Final report ─────────────────────────────────────────────────────
        output.WriteLine("=== REAL CODEGEN V3.1 VALIDATION SUMMARY ===");
        output.WriteLine($"  Recording:                   AIRecorder/code.ts ({actions.Count} actions)");
        output.WriteLine($"  Repository scanned:          {RealFrameworkRoot}");
        output.WriteLine($"  Methods found:               {metadata.Methods.Count}");
        output.WriteLine($"  Locators found:              {metadata.Locators.Count}");
        output.WriteLine($"  Steps found:                 {metadata.Steps.Count}");
        output.WriteLine($"  Total V3.1 decisions:        {decisions.Count}");
        output.WriteLine($"    PageElements REUSE:        {reuseLocators}");
        output.WriteLine($"    PageElements EXTEND:       {extendLocators}");
        output.WriteLine($"    PageElements CREATE:       {createLocators}");
        output.WriteLine($"    PageActions REUSE:         {decisions.Count(d => d.ComponentType == "PageActions" && d.Decision == ReuseDecisionType.Reuse)}");
        output.WriteLine($"    PageActions EXTEND:        {decisions.Count(d => d.ComponentType == "PageActions" && d.Decision == ReuseDecisionType.Extend)}");
        output.WriteLine($"    PageActions CREATE:        {decisions.Count(d => d.ComponentType == "PageActions" && d.Decision == ReuseDecisionType.Create)}");
        output.WriteLine($"    StepDefinitions REUSE:     {reuseSteps}");
        output.WriteLine($"    StepDefinitions EXTEND:    {extendSteps}");
        output.WriteLine($"    StepDefinitions CREATE:    {createSteps}");
        output.WriteLine($"  Plan REUSE:                  {plan.ReuseCount}");
        output.WriteLine($"  Plan EXTEND:                 {plan.ExtendCount}");
        output.WriteLine($"  Plan CREATE:                 {plan.CreateCount}");
        output.WriteLine($"  Architecture validation:     {(validation.IsValid ? "PASS" : "FAIL")}");
        output.WriteLine($"  Production framework:        NOT MODIFIED");
        output.WriteLine($"  PageName limitation (L1):    {(allActionsHavePlainPageName ? "PRESENT — StepDef EXTEND/CREATE limited" : "OK")}");
        output.WriteLine("");

        // ── Assertions ────────────────────────────────────────────────────────
        // The recording must parse to non-empty actions
        Assert.NotEmpty(actions);

        // The repository must be scannable
        Assert.True(metadata.Methods.Count > 0, "Repository must have scanned methods.");

        // The pipeline must produce decisions
        Assert.True(decisions.Count > 0, "V3.1 must produce at least one architecture decision.");

        // Architecture validation must pass
        Assert.True(validation.IsValid,
            $"Architecture validation failed: {string.Join("; ", validation.Errors)}");

        // No duplicate CREATE targets
        bool noDuplicateCreates = plan.Changes
            .Where(c => c.Action == "CREATE")
            .GroupBy(c => c.FilePath, StringComparer.OrdinalIgnoreCase)
            .All(g => g.Count() == 1);
        Assert.True(noDuplicateCreates, "Duplicate CREATE targets detected in plan.");
    }
}
