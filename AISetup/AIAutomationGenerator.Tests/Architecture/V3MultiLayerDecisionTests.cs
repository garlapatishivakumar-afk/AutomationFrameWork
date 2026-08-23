using AIAutomationGenerator.Architecture;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests.Architecture;

/// <summary>
/// V3.1 — Multi-Layer Architecture Intelligence tests.
/// Verifies that ArchitectureDecisionEngine produces independent decisions for
/// PageElements and StepDefinitions layers in addition to PageActions.
/// </summary>
public class V3MultiLayerDecisionTests
{
    private readonly ArchitectureDecisionEngine engine = new();

    // ─────────────────────────────────────────────────────────────────────────
    // PageElements — REUSE
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_PageElementsReuse_WhenLocatorMatchesViaGetByRoleName()
    {
        // Arrange: locator whose name contains the getByRole 'name' option value
        var metadata = new RepositoryMetadata();
        metadata.Locators.Add(new LocatorModel
        {
            Name     = "SearchQueueButton",
            PageName = "ViewDashboard",
            FilePath = "PageElements/ViewDashboardObjects.cs"
        });

        // Action carries getByRole('button', { name: 'Search Queue' }) as Target
        var flows = BuildFlows("Click", "button", "ViewDashboard",
            target: "await page.getByRole('button', { name: 'Search Queue' }).click();");

        // Act
        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        // Assert: must have a PageElements REUSE decision
        var locatorDecision = decisions.FirstOrDefault(d => d.ComponentType == "PageElements");
        Assert.NotNull(locatorDecision);
        Assert.Equal(ReuseDecisionType.Reuse, locatorDecision!.Decision);
        Assert.Equal("SearchQueueButton", locatorDecision.ExistingMemberName);
        Assert.Equal("PageElements/ViewDashboardObjects.cs", locatorDecision.TargetFile);
        Assert.True(locatorDecision.Confidence >= 0.75);
    }

    [Fact]
    public void Decide_PageElementsReuse_WhenLocatorMatchesViaCssSelectorExact()
    {
        // Arrange: locator whose Selector exactly matches the recording's LocatorValue
        var metadata = new RepositoryMetadata();
        metadata.Locators.Add(new LocatorModel
        {
            Name     = "SearchUserDropdown",
            PageName = "ViewDashboard",
            FilePath = "PageElements/ViewDashboardObjects.cs",
            Selector = "#ctl00_ContentPlaceHolder1_ddlSearchUser"
        });

        // LocatorValue is the CSS selector extracted by RecordingParser for locator() calls
        var flows = BuildFlows("Select", "#ctl00_ContentPlaceHolder1_ddlSearchUser", "ViewDashboard",
            locatorValue: "#ctl00_ContentPlaceHolder1_ddlSearchUser");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        var locatorDecision = decisions.FirstOrDefault(d => d.ComponentType == "PageElements");
        Assert.NotNull(locatorDecision);
        Assert.Equal(ReuseDecisionType.Reuse, locatorDecision!.Decision);
        Assert.Equal("SearchUserDropdown", locatorDecision.ExistingMemberName);
        Assert.True(locatorDecision.Confidence >= 0.75);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PageElements — EXTEND
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_PageElementsExtend_WhenLocatorFileExistsButLocatorMissing()
    {
        // Arrange: locator file exists for the same page but no matching locator
        var metadata = new RepositoryMetadata();
        metadata.Locators.Add(new LocatorModel
        {
            Name     = "ExistingButton",
            PageName = "ViewDashboard",  // same page
            FilePath = "PageElements/ViewDashboardObjects.cs"
        });

        // Action targets "ViewDashboard" page (meaningful PageName — uppercase letters)
        // but the locator "NewWidget" does not exist
        var flows = BuildFlows("Click", "button", "ViewDashboard",
            target: "await page.getByRole('button', { name: 'New Widget' }).click();");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        var locatorDecision = decisions.FirstOrDefault(d => d.ComponentType == "PageElements");
        Assert.NotNull(locatorDecision);
        Assert.Equal(ReuseDecisionType.Extend, locatorDecision!.Decision);
        Assert.Equal("PageElements/ViewDashboardObjects.cs", locatorDecision.TargetFile);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PageElements — CREATE
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_PageElementsCreate_WhenNoSuitablePageElementsFileExists()
    {
        // Arrange: locators exist but none belong to the recording's page context
        var metadata = new RepositoryMetadata();
        metadata.Locators.Add(new LocatorModel
        {
            Name     = "LoginUsernameField",
            PageName = "Login",          // different page
            FilePath = "PageElements/LoginObjects.cs"
        });

        // Action targets "CheckoutPage" (meaningful: has uppercase) — no related file
        var flows = BuildFlows("Click", "button", "CheckoutPage",
            target: "await page.getByRole('button', { name: 'Place Order' }).click();");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        var locatorDecision = decisions.FirstOrDefault(d => d.ComponentType == "PageElements");
        Assert.NotNull(locatorDecision);
        Assert.Equal(ReuseDecisionType.Create, locatorDecision!.Decision);
        Assert.True(locatorDecision.RequiresHumanApproval);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // StepDefinitions — REUSE
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_StepDefinitionsReuse_WhenStepExists()
    {
        // Arrange: step definition whose method name contains ActionType + roleNameNoSpaces
        var metadata = new RepositoryMetadata();
        metadata.Steps.Add(new StepDefinitionModel
        {
            MethodName = "WhenUserClicksSearchQueueButton",
            StepText   = "user clicks Search Queue button",
            FilePath   = "StepDefinitions/ViewDashboardSteps.cs"
        });

        var flows = BuildFlows("Click", "button", "page",
            target: "await page.getByRole('button', { name: 'Search Queue' }).click();");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        var stepDecision = decisions.FirstOrDefault(d => d.ComponentType == "StepDefinitions");
        Assert.NotNull(stepDecision);
        Assert.Equal(ReuseDecisionType.Reuse, stepDecision!.Decision);
        Assert.Equal("WhenUserClicksSearchQueueButton", stepDecision.ExistingMemberName);
        Assert.True(stepDecision.Confidence >= 0.75);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // StepDefinitions — EXTEND
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_StepDefinitionsExtend_WhenStepFileExistsButStepMissing()
    {
        // Arrange: step file for "ViewDashboard" exists but the specific step does not
        var metadata = new RepositoryMetadata();
        metadata.Steps.Add(new StepDefinitionModel
        {
            MethodName = "WhenUserClicksAdministration",
            StepText   = "user clicks on Administration link",
            FilePath   = "StepDefinitions/ViewDashboardSteps.cs"
        });

        // Action targets "ViewDashboard" page explicitly (meaningful PageName).
        // The action's role name "NewFeature" has no matching step.
        var flows = BuildFlows("Click", "button", "ViewDashboard",
            target: "await page.getByRole('button', { name: 'New Feature' }).click();");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        var stepDecision = decisions.FirstOrDefault(d => d.ComponentType == "StepDefinitions");
        Assert.NotNull(stepDecision);
        Assert.Equal(ReuseDecisionType.Extend, stepDecision!.Decision);
        Assert.Contains("ViewDashboard", stepDecision.TargetFile);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // StepDefinitions — CREATE
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_StepDefinitionsCreate_WhenNoStepFileExists()
    {
        // Arrange: steps exist but only for a different page; action targets a new page
        var metadata = new RepositoryMetadata();
        metadata.Steps.Add(new StepDefinitionModel
        {
            MethodName = "WhenUserLogsIn",
            StepText   = "user logs in",
            FilePath   = "StepDefinitions/LoginSteps.cs"   // different page
        });

        // Action targets "CheckoutPage" which has no step file
        var flows = BuildFlows("Click", "button", "CheckoutPage",
            target: "await page.getByRole('button', { name: 'Proceed' }).click();");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        var stepDecision = decisions.FirstOrDefault(d => d.ComponentType == "StepDefinitions");
        Assert.NotNull(stepDecision);
        Assert.Equal(ReuseDecisionType.Create, stepDecision!.Decision);
        Assert.Equal("CheckoutPageSteps", stepDecision.TargetComponent);
        Assert.True(stepDecision.RequiresHumanApproval);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Multi-layer: single action can produce decisions for all three layers
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_SingleAction_ProducesDecisionsForAllThreeLayers()
    {
        // Arrange: repository has matching method, locator, AND step
        var metadata = new RepositoryMetadata();

        metadata.Methods.Add(new MethodModel
        {
            Name      = "ClickSearchQueueButtonAsync",
            ClassName = "ViewDashboardMethods",
            FilePath  = "PageActions/ViewDashboardMethods.cs"
        });
        metadata.Locators.Add(new LocatorModel
        {
            Name     = "SearchQueueButton",
            PageName = "ViewDashboard",
            FilePath = "PageElements/ViewDashboardObjects.cs"
        });
        metadata.Steps.Add(new StepDefinitionModel
        {
            MethodName = "WhenUserClicksSearchQueueButton",
            StepText   = "user clicks Search Queue button",
            FilePath   = "StepDefinitions/ViewDashboardSteps.cs"
        });

        var flows = BuildFlows("Click", "button", "page",
            target: "await page.getByRole('button', { name: 'Search Queue' }).click();");

        // Act
        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        // Assert: separate REUSE decisions for each layer
        var pageActions    = decisions.Where(d => d.ComponentType == "PageActions").ToList();
        var pageElements   = decisions.Where(d => d.ComponentType == "PageElements").ToList();
        var stepDefs       = decisions.Where(d => d.ComponentType == "StepDefinitions").ToList();

        Assert.NotEmpty(pageActions);
        Assert.NotEmpty(pageElements);
        Assert.NotEmpty(stepDefs);

        Assert.Equal(ReuseDecisionType.Reuse, pageActions[0].Decision);
        Assert.Equal(ReuseDecisionType.Reuse, pageElements[0].Decision);
        Assert.Equal(ReuseDecisionType.Reuse, stepDefs[0].Decision);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Multi-layer: ImplementationPlanner handles cross-layer decisions correctly
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void CreatePlan_MultiLayerDecisions_AreHandledWithCorrectOrdering()
    {
        var planner = new ImplementationPlanner(new FrameworkLayerMapper());

        var decisions = new List<ReuseDecision>
        {
            new ReuseDecision
            {
                Decision           = ReuseDecisionType.Reuse,
                ComponentType      = "PageActions",
                TargetComponent    = "ViewDashboardMethods",
                ExistingMemberName = "ClickSearchQueueButtonAsync",
                TargetFile         = "PageActions/ViewDashboardMethods.cs",
                Confidence         = 0.95
            },
            new ReuseDecision
            {
                Decision           = ReuseDecisionType.Reuse,
                ComponentType      = "PageElements",
                TargetComponent    = "ViewDashboardObjects",
                ExistingMemberName = "SearchQueueButton",
                TargetFile         = "PageElements/ViewDashboardObjects.cs",
                Confidence         = 0.90
            },
            new ReuseDecision
            {
                Decision           = ReuseDecisionType.Create,
                ComponentType      = "StepDefinitions",
                TargetComponent    = "ViewDashboardSteps",
                ExistingMemberName = "WhenUserClicksSearchQueueButtonAsync",
                TargetFile         = string.Empty,
                Confidence         = 0.50
            }
        };

        var plan = planner.CreatePlan(
            new List<BusinessFlowModel> { new BusinessFlowModel { Name = "SearchQueue" } },
            decisions,
            new RepositoryMetadata(),
            Path.GetTempPath());

        // All three decisions must appear in the plan
        Assert.Equal(3, plan.Changes.Count);

        // REUSE must come before CREATE
        int lastReuse  = plan.Changes.Select(c => c.Action).ToList().LastIndexOf("REUSE");
        int firstCreate = plan.Changes.FindIndex(c => c.Action == "CREATE");
        Assert.True(lastReuse < firstCreate);
    }

    [Fact]
    public void CreatePlan_MultiLayerDecisions_ReuseExtendCreateOrdering()
    {
        var planner = new ImplementationPlanner(new FrameworkLayerMapper());

        var decisions = new List<ReuseDecision>
        {
            new ReuseDecision
            {
                Decision           = ReuseDecisionType.Create,
                ComponentType      = "PageElements",
                TargetComponent    = "NewPageObjects",
                ExistingMemberName = "NewLocator",
                Confidence         = 0.50
            },
            new ReuseDecision
            {
                Decision           = ReuseDecisionType.Reuse,
                ComponentType      = "PageActions",
                TargetComponent    = "ExistingMethods",
                ExistingMemberName = "ExistingMethod",
                TargetFile         = "PageActions/Existing.cs",
                Confidence         = 0.90
            },
            new ReuseDecision
            {
                Decision          = ReuseDecisionType.Extend,
                ComponentType     = "StepDefinitions",
                TargetComponent   = "ExistingSteps",
                TargetFile        = "StepDefinitions/ExistingSteps.cs",
                Confidence        = 0.60
            }
        };

        var plan = planner.CreatePlan(
            new List<BusinessFlowModel> { new BusinessFlowModel { Name = "Test" } },
            decisions,
            new RepositoryMetadata(),
            Path.GetTempPath());

        var actions = plan.Changes.Select(c => c.Action).ToList();

        // Ordering: REUSE → EXTEND → CREATE (regardless of component layer)
        Assert.Equal("REUSE",  actions[0]);
        Assert.Equal("EXTEND", actions[1]);
        Assert.Equal("CREATE", actions[2]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Guard: PageElements layer is skipped when action has no locator signal
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_PageElements_NotEmitted_WhenNoLocatorSignal()
    {
        // Simulate a Navigate/goto action: no LocatorType, LocatorArgument, or LocatorValue
        var metadata = new RepositoryMetadata();
        metadata.Locators.Add(new LocatorModel
        {
            Name = "SomeButton", PageName = "SomePage", FilePath = "PageElements/SomeObjects.cs"
        });

        var flow = new BusinessFlowModel { Name = "Navigate" };
        flow.Actions.Add(new RecordingActionModel
        {
            ActionType      = "Navigate",
            LocatorType     = string.Empty,
            LocatorArgument = string.Empty,
            LocatorValue    = string.Empty,
            PageName        = "page"
        });
        var flows = new List<BusinessFlowModel> { flow };

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        // No PageElements decision should be emitted for navigate-only actions
        Assert.DoesNotContain(decisions, d => d.ComponentType == "PageElements");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Guard: StepDefinitions layer is skipped when metadata has no steps
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_StepDefinitions_NotEmitted_WhenMetadataHasNoSteps()
    {
        var metadata = new RepositoryMetadata(); // No steps

        var flows = BuildFlows("Click", "button", "ViewDashboard",
            target: "await page.getByRole('button', { name: 'Search' }).click();");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        Assert.DoesNotContain(decisions, d => d.ComponentType == "StepDefinitions");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Guard: PageElements layer is skipped when metadata has no locators
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_PageElements_NotEmitted_WhenMetadataHasNoLocators()
    {
        var metadata = new RepositoryMetadata(); // No locators

        var flows = BuildFlows("Click", "button", "ViewDashboard",
            target: "await page.getByRole('button', { name: 'Search' }).click();");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        Assert.DoesNotContain(decisions, d => d.ComponentType == "PageElements");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Regression: existing PageActions REUSE still works exactly as before
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_PageActions_ReuseUnchanged_WithMultiLayerData()
    {
        // Full metadata — ensure PageActions scoring is unchanged when other layers also have data
        var metadata = new RepositoryMetadata();
        metadata.Methods.Add(new MethodModel
        {
            Name      = "ClickSearchQueueButtonAsync",
            ClassName = "ViewDashboardMethods",
            FilePath  = "PageActions/ViewDashboardMethods.cs"
        });
        metadata.Locators.Add(new LocatorModel
        {
            Name = "SearchQueueButton", PageName = "ViewDashboard",
            FilePath = "PageElements/ViewDashboardObjects.cs"
        });
        metadata.Steps.Add(new StepDefinitionModel
        {
            MethodName = "WhenUserClicksSearchQueueButton", StepText = "user clicks Search Queue button",
            FilePath = "StepDefinitions/ViewDashboardSteps.cs"
        });

        var flows = BuildFlows("Click", "button", "page",
            target: "await page.getByRole('button', { name: 'Search Queue' }).click();");

        var decisions = engine.Decide(flows, new RepositoryKnowledge(), metadata);

        var pageActionsDecision = decisions.First(d => d.ComponentType == "PageActions");
        Assert.Equal(ReuseDecisionType.Reuse, pageActionsDecision.Decision);
        Assert.Equal("ClickSearchQueueButtonAsync", pageActionsDecision.ExistingMemberName);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static List<BusinessFlowModel> BuildFlows(
        string actionType,
        string locatorArgument,
        string pageName,
        string target       = "",
        string locatorType  = "getByRole",
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
                ? $"await page.getByRole('{locatorArgument.ToLower()}').{actionType.ToLower()}();"
                : target,
            RawCode         = target
        });
        return new List<BusinessFlowModel> { flow };
    }
}
