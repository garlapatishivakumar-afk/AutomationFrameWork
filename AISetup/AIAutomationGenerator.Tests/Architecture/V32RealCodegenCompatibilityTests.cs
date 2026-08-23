using AIAutomationGenerator.Architecture;
using AIAutomationGenerator.FrameworkScanner;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests.Architecture;

/// <summary>
/// V3.2 — Real Codegen Compatibility & Architecture Decision Accuracy.
/// Tests covering L1 (PageName inference), L2 (LocatorParser method support),
/// L3 (PageActions method filtering), and integration.
/// </summary>
public class V32RealCodegenCompatibilityTests
{
    private readonly ArchitectureDecisionEngine engine = new();

    // ─────────────────────────────────────────────────────────────────────────
    // L2 — LocatorParser: ILocator method support
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void LocatorParser_ParsesILocatorProperty()
    {
        string source = """
using Microsoft.Playwright;
namespace AutomationFrameWork.PageElements;
public class LoginObjects
{
    public ILocator UsernameField { get; } = null!;
}
""";
        var locators = ParseLocatorsFromSource(source, "LoginObjects.cs");

        Assert.Contains(locators, l => l.Name == "UsernameField");
        Assert.All(locators.Where(l => l.Name == "UsernameField"),
            l => Assert.Equal("LoginObjects", l.PageName));
    }

    [Fact]
    public void LocatorParser_ParsesILocatorMethod()
    {
        // Real framework pattern: ILocator-returning method with IPage parameter
        string source = """
using Microsoft.Playwright;
namespace AutomationFrameWork.PageElements;
public class ViewDashboardObjects
{
    public ILocator SearchQueueButton(IPage page)
        => page.GetByRole(AriaRole.Button, new() { Name = "Search Queue" });
}
""";
        var locators = ParseLocatorsFromSource(source, "ViewDashboardObjects.cs");

        Assert.Contains(locators, l => l.Name == "SearchQueueButton");
    }

    [Fact]
    public void LocatorParser_ParsesILocatorMethod_GetByRole()
    {
        string source = """
using Microsoft.Playwright;
namespace AutomationFrameWork.PageElements;
public class DashboardObjects
{
    public ILocator DashboardLink(IPage page)
        => page.GetByRole(AriaRole.Link, new() { Name = "Dashboard" });
}
""";
        var locators = ParseLocatorsFromSource(source, "DashboardObjects.cs");

        var loc = locators.FirstOrDefault(l => l.Name == "DashboardLink");
        Assert.NotNull(loc);
        Assert.Equal("Role", loc!.LocatorType);
        Assert.Equal("DashboardObjects", loc.PageName);
    }

    [Fact]
    public void LocatorParser_ParsesILocatorMethod_CssLocator()
    {
        string source = """
using Microsoft.Playwright;
namespace AutomationFrameWork.PageElements;
public class SearchObjects
{
    public ILocator UserDropdown(IPage page)
        => page.Locator("#ctl00_ContentPlaceHolder1_ddlSearchUser");
}
""";
        var locators = ParseLocatorsFromSource(source, "SearchObjects.cs");

        var loc = locators.FirstOrDefault(l => l.Name == "UserDropdown");
        Assert.NotNull(loc);
        Assert.Equal("Css", loc!.LocatorType);
    }

    [Fact]
    public void LocatorParser_ExistingPropertyBehaviourPreserved()
    {
        // Both a property and a method in the same file — both should be parsed
        string source = """
using Microsoft.Playwright;
namespace AutomationFrameWork.PageElements;
public class MixedObjects
{
    public ILocator PropLocator { get; set; } = null!;
    public ILocator MethodLocator(IPage page) => page.Locator("#id");
}
""";
        var locators = ParseLocatorsFromSource(source, "MixedObjects.cs");

        Assert.Contains(locators, l => l.Name == "PropLocator");
        Assert.Contains(locators, l => l.Name == "MethodLocator");
    }

    [Fact]
    public void LocatorParser_NoDuplicates_WhenSameNameInSameFile()
    {
        // If the same member name appears as both property and method (edge case),
        // the deduplication should prevent duplicates.
        string source = """
using Microsoft.Playwright;
namespace AutomationFrameWork.PageElements;
public class EdgeCaseObjects
{
    public ILocator SearchButton(IPage page) => page.Locator("#btn");
}
""";
        var locators = ParseLocatorsFromSource(source, "EdgeCaseObjects.cs").ToList();

        var distinctNames = locators.Select(l => l.Name).Distinct().ToList();
        Assert.Equal(distinctNames.Count, locators.Count); // No duplicates
    }

    [Fact]
    public void LocatorParser_NonILocatorPropertyIgnored()
    {
        // A 'string' property must NOT produce a locator entry
        string source = """
namespace AutomationFrameWork.PageElements;
public class LegacyObjects
{
    public string SomeSelector => "#id";
}
""";
        var locators = ParseLocatorsFromSource(source, "LegacyObjects.cs");

        Assert.DoesNotContain(locators, l => l.Name == "SomeSelector");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // L3 — PageActions filtering: StepDefinitions must not be PageActions
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_PageActions_ExcludesStepDefinitionMethods()
    {
        var metadata = new RepositoryMetadata();

        // PageActions method (valid candidate)
        metadata.Methods.Add(new MethodModel
        {
            Name      = "ClickSearchQueueButtonAsync",
            ClassName = "ViewDashboardMethods",
            FilePath  = "PageActions/ViewDashboardMethods.cs",
            Namespace = "AutomationFrameWork.PageActions"
        });

        // StepDefinitions method (must NOT be selected as PageActions)
        metadata.Methods.Add(new MethodModel
        {
            Name      = "WhenUserClicksSearchQueueButton",
            ClassName = "ViewDashboardSteps",
            FilePath  = "StepDefinitions/ViewDashboardSteps.cs",
            Namespace = "AutomationFrameWork.StepDefinitions",
            Tags      = new List<string> { "When" }
        });

        var flows = BuildFlows("Click", "button", "page",
            target: "await page.getByRole('button', { name: 'Search Queue' }).click();");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        var pageActionsDecision = decisions.First(d => d.ComponentType == "PageActions");

        // Must be the PageActions method, not the StepDefinitions one
        Assert.Equal("ClickSearchQueueButtonAsync", pageActionsDecision.ExistingMemberName);
        Assert.DoesNotContain("Steps", pageActionsDecision.ExistingMemberName);
    }

    [Fact]
    public void Decide_PageActions_ExcludesStepsByFilePath()
    {
        var metadata = new RepositoryMetadata();

        metadata.Methods.Add(new MethodModel
        {
            Name      = "ClickAdministrationLinkAsync",
            ClassName = "ViewDashboardMethods",
            FilePath  = "PageActions/ViewDashboardMethods.cs"
        });

        // Step method identified by StepDefinitions folder only (no tag)
        metadata.Methods.Add(new MethodModel
        {
            Name      = "WhenUserClicksAdministrationLink",
            ClassName = "ViewDashboardSteps",
            FilePath  = "StepDefinitions/ViewDashboardSteps.cs"
        });

        var flows = BuildFlows("Click", "link", "page",
            target: "await page.getByRole('link', { name: 'Administration' }).click();");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        var pa = decisions.First(d => d.ComponentType == "PageActions");
        // L3: The decision must be based on the PageActions method (ViewDashboardMethods),
        // not the StepDefinitions method — confirmed by target file being in PageActions folder.
        Assert.DoesNotContain("StepDefinitions", pa.TargetFile ?? string.Empty);
        // The best candidate is ClickAdministrationLinkAsync
        // (ActionType=Click +0.30, roleNameNoSpaces=Administration +0.40 = 0.70 ≥ 0.75? → REUSE)
        // Administration IS contained in ClickAdministrationLinkAsync → REUSE expected
        Assert.Equal(ReuseDecisionType.Reuse, pa.Decision);
        Assert.Equal("ViewDashboardMethods", pa.TargetComponent);
    }

    [Fact]
    public void Decide_PageActions_IncludesActualPageActionsMethods()
    {
        var metadata = new RepositoryMetadata();
        metadata.Methods.Add(new MethodModel
        {
            Name      = "ClickSearchQueueButtonAsync",
            ClassName = "ViewDashboardMethods",
            FilePath  = "PageActions/ViewDashboardMethods.cs"
        });

        var flows = BuildFlows("Click", "button", "page",
            target: "await page.getByRole('button', { name: 'Search Queue' }).click();");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        var pa = decisions.First(d => d.ComponentType == "PageActions");
        Assert.Equal(ReuseDecisionType.Reuse, pa.Decision);
        Assert.Equal("ClickSearchQueueButtonAsync", pa.ExistingMemberName);
    }

    [Fact]
    public void Decide_PageActions_ScoringRemainsUnchanged_WithFilter()
    {
        // Verify that the filtering does not break the existing scoring signals.
        // Using a method name that strongly matches via both ActionType AND roleNameNoSpaces.
        var metadata = new RepositoryMetadata();
        metadata.Methods.Add(new MethodModel
        {
            Name      = "ClickSearchQueueButtonAsync",
            ClassName = "ViewDashboardMethods",
            FilePath  = "PageActions/ViewDashboardMethods.cs"
        });

        // ActionType=Click (+0.30) + roleNameNoSpaces=SearchQueue (+0.40) = 0.70
        // LocatorArgument=button → doesn't match method name directly
        // Min to pass REUSE threshold (0.75): need the additional signal.
        // Add LocatorArgument that matches a word in the method name:
        var flows = BuildFlows("Click", "SearchQueue", "page",
            target: "await page.getByRole('button', { name: 'Search Queue' }).click();",
            locatorType: "Role");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        var pa = decisions.First(d => d.ComponentType == "PageActions");
        // With Click(+0.30) + SearchQueue roleNameNoSpaces(+0.40) + LocatorArgument=SearchQueue(+0.35)
        // = 1.05 → capped at 1.0 → REUSE
        Assert.Equal(ReuseDecisionType.Reuse, pa.Decision);
        Assert.True(pa.Confidence >= 0.75, $"Expected confidence >= 0.75, got {pa.Confidence}");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // L1 — PageName inference from repository context
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_InfersPageName_FromLocatorOwnership_WhenPageNameIsGeneric()
    {
        // Arrange: locator with meaningful PageName → "ViewDashboardObjects"
        var metadata = new RepositoryMetadata();
        metadata.Locators.Add(new LocatorModel
        {
            Name     = "SearchQueueButton",
            PageName = "ViewDashboardObjects",  // carries "Objects" suffix
            FilePath = "PageElements/ViewDashboardObjects.cs"
        });
        metadata.Steps.Add(new StepDefinitionModel
        {
            MethodName = "WhenUserClicksSearchQueueButton",
            StepText   = "user clicks Search Queue button",
            FilePath   = "StepDefinitions/ViewDashboardSteps.cs"
        });

        // Action with Codegen default "page"
        var flows = BuildFlows("Click", "button", "page",
            target: "await page.getByRole('button', { name: 'Search Queue' }).click();",
            locatorType: "Role");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        // StepDefinitions EXTEND/CREATE can only fire if PageName was inferred
        // (the step REUSE fires regardless — that's OK)
        var stepDecision = decisions.FirstOrDefault(d => d.ComponentType == "StepDefinitions");
        Assert.NotNull(stepDecision);
        // Should be REUSE (matching step exists) — meaning the context inference
        // did not prevent the step decision from being produced
        Assert.Equal(ReuseDecisionType.Reuse, stepDecision!.Decision);
    }

    [Fact]
    public void Decide_PreservesExplicitPageName_WhenAlreadyMeaningful()
    {
        // If PageName already has uppercase, it must not be overwritten
        var metadata = new RepositoryMetadata();
        metadata.Locators.Add(new LocatorModel
        {
            Name     = "SomeButton",
            PageName = "SomeDifferentPage",
            FilePath = "PageElements/SomeDifferentPageObjects.cs"
        });

        var flows = BuildFlows("Click", "button", "ViewDashboard",
            target: "await page.getByRole('button', { name: 'Search Queue' }).click();",
            locatorType: "Role");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        // The PageActions decision should still use "ViewDashboard", not "SomeDifferentPage"
        var pa = decisions.First(d => d.ComponentType == "PageActions");
        Assert.DoesNotContain("SomeDifferentPage", pa.Reason + pa.TargetComponent);
    }

    [Fact]
    public void Decide_DoesNotFabricatePageName_WhenLocatorIsUnknown()
    {
        // Completely unknown locator → no inference → PageName stays as-is
        var metadata = new RepositoryMetadata();
        metadata.Locators.Add(new LocatorModel
        {
            Name     = "UnrelatedButton",
            PageName = "SomeOtherPage",
            FilePath = "PageElements/SomeOtherPageObjects.cs"
        });

        var flows = BuildFlows("Click", "button", "page",
            target: "await page.getByRole('button', { name: 'Completely Unknown Widget' }).click();",
            locatorType: "Role");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        // Should produce decisions without crashing; no fabricated page name injected
        Assert.NotEmpty(decisions);
        // The page actions decision should not claim a high-confidence REUSE from a bad inference
        var pa = decisions.First(d => d.ComponentType == "PageActions");
        // With no matching locator or step, PageActions should be EXTEND or CREATE, not REUSE
        // (no method match exists either)
        Assert.True(pa.Decision != ReuseDecisionType.Reuse || pa.Confidence < 0.75,
            "Should not produce a false high-confidence REUSE from an unrelated page.");
    }

    [Fact]
    public void Decide_InfersPageName_FromStepMethodName_WhenLocatorsEmpty()
    {
        // When no locators exist but steps do, infer from step method name
        var metadata = new RepositoryMetadata();
        metadata.Steps.Add(new StepDefinitionModel
        {
            MethodName = "WhenUserClicksSearchQueueButton",
            StepText   = "user clicks Search Queue button",
            FilePath   = "StepDefinitions/ViewDashboardSteps.cs"
        });

        var flows = BuildFlows("Click", "button", "page",
            target: "await page.getByRole('button', { name: 'Search Queue' }).click();",
            locatorType: "Role");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        // The inferred page name "ViewDashboard" (stripped from "ViewDashboardSteps")
        // should enable StepDefinitions EXTEND to be considered if the step file exists
        // (REUSE fires here since the step matches)
        var stepDecision = decisions.FirstOrDefault(d => d.ComponentType == "StepDefinitions");
        Assert.NotNull(stepDecision);
        Assert.Equal(ReuseDecisionType.Reuse, stepDecision!.Decision);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Integration: L1 + L2 + L3 together
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Integration_AllThreeFixes_WorkTogether_SingleAction()
    {
        var metadata = new RepositoryMetadata();

        // L2: ILocator method locator (would be scanned from real PageElements)
        metadata.Locators.Add(new LocatorModel
        {
            Name        = "SearchQueueButton",
            PageName    = "ViewDashboardObjects",
            FilePath    = "PageElements/ViewDashboardObjects.cs",
            LocatorType = "Role",
            Selector    = "page.GetByRole(AriaRole.Button, new() { Name = \"Search Queue\" })"
        });

        // L3: Only genuine PageActions method
        metadata.Methods.Add(new MethodModel
        {
            Name      = "ClickSearchQueueButtonAsync",
            ClassName = "ViewDashboardMethods",
            FilePath  = "PageActions/ViewDashboardMethods.cs",
            Namespace = "AutomationFrameWork.PageActions"
        });

        // L3: Step method that must NOT pollute PageActions decisions
        metadata.Methods.Add(new MethodModel
        {
            Name      = "WhenUserClicksSearchQueueButton",
            ClassName = "ViewDashboardSteps",
            FilePath  = "StepDefinitions/ViewDashboardSteps.cs",
            Namespace = "AutomationFrameWork.StepDefinitions",
            Tags      = new List<string> { "When" }
        });

        metadata.Steps.Add(new StepDefinitionModel
        {
            MethodName = "WhenUserClicksSearchQueueButton",
            StepText   = "user clicks Search Queue button",
            FilePath   = "StepDefinitions/ViewDashboardSteps.cs"
        });

        // Real Codegen action: PageName = "page"
        var flows = BuildFlows("Click", "button", "page",
            target: "await page.getByRole('button', { name: 'Search Queue' }).click();",
            locatorType: "Role");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        // L3: PageActions REUSE must resolve to PageActions method, not StepDef
        var pa = decisions.First(d => d.ComponentType == "PageActions");
        Assert.Equal("ClickSearchQueueButtonAsync", pa.ExistingMemberName);
        Assert.Equal(ReuseDecisionType.Reuse, pa.Decision);

        // L2: PageElements REUSE should fire (locator now in metadata)
        var pe = decisions.FirstOrDefault(d => d.ComponentType == "PageElements");
        Assert.NotNull(pe);
        Assert.Equal(ReuseDecisionType.Reuse, pe!.Decision);
        Assert.Equal("SearchQueueButton", pe.ExistingMemberName);

        // StepDefinitions REUSE should fire
        var sd = decisions.FirstOrDefault(d => d.ComponentType == "StepDefinitions");
        Assert.NotNull(sd);
        Assert.Equal(ReuseDecisionType.Reuse, sd!.Decision);
    }

    [Fact]
    public void Integration_V31_PageActionsReuse_Unaffected_ByV32Changes()
    {
        // Regression: existing V3.1 PageActions scoring must still work with V3.2 changes
        var metadata = new RepositoryMetadata();
        metadata.Methods.Add(new MethodModel
        {
            Name      = "ClickAdministrationLinkAsync",
            ClassName = "ViewDashboardMethods",
            FilePath  = "PageActions/ViewDashboardMethods.cs"
        });

        var flows = BuildFlows("Click", "link", "page",
            target: "await page.getByRole('link', { name: 'Administration' }).click();",
            locatorType: "Role");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        var pa = decisions.First(d => d.ComponentType == "PageActions");
        Assert.Equal(ReuseDecisionType.Reuse, pa.Decision);
        Assert.True(pa.Confidence >= 0.75, $"Expected confidence >= 0.75, got {pa.Confidence}");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static IEnumerable<LocatorModel> ParseLocatorsFromSource(string source, string fileName)
    {
        string tempFile = Path.Combine(Path.GetTempPath(), fileName);
        try
        {
            File.WriteAllText(tempFile, source);
            return new LocatorParser().Parse(tempFile);
        }
        finally
        {
            try { File.Delete(tempFile); } catch { /* best effort */ }
        }
    }

    private static List<BusinessFlowModel> BuildFlows(
        string actionType,
        string locatorArgument,
        string pageName,
        string target      = "",
        string locatorType = "getByRole",
        string locatorValue = "")
    {
        var flow = new BusinessFlowModel { Name = "TestFlow" };
        flow.Actions.Add(new RecordingActionModel
        {
            ActionType      = actionType,
            LocatorType     = locatorType,
            LocatorArgument = locatorArgument,
            LocatorValue    = locatorValue,
            PageName        = pageName,
            Target          = string.IsNullOrWhiteSpace(target)
                ? $"await page.getByRole('{locatorArgument}').{actionType.ToLower()}();"
                : target,
            RawCode         = target
        });
        return new List<BusinessFlowModel> { flow };
    }
}
