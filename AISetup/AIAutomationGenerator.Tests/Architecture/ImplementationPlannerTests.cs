using AIAutomationGenerator.Architecture;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests.Architecture;

public class ImplementationPlannerTests
{
    private readonly ImplementationPlannerTestHarness harness = new();

    [Fact]
    public void CreatePlan_ReuseDecision_ProducesReuseChange()
    {
        var decisions = new List<ReuseDecision>
        {
            new ReuseDecision
            {
                Decision         = ReuseDecisionType.Reuse,
                TargetComponent  = "ViewDashboardMethods",
                TargetFile       = "PageActions/ViewDashboardMethods.cs",
                ComponentType    = "PageActions",
                ExistingMemberName = "ClickSearchQueueButton",
                Confidence       = 0.95
            }
        };

        var plan = harness.CreatePlan(decisions);

        Assert.Single(plan.Changes);
        Assert.Equal("REUSE", plan.Changes[0].Action);
        Assert.Equal(0, plan.AffectedFiles.Count); // REUSE does not modify files
    }

    [Fact]
    public void CreatePlan_ExtendDecision_ProducesExtendChange()
    {
        var decisions = new List<ReuseDecision>
        {
            new ReuseDecision
            {
                Decision         = ReuseDecisionType.Extend,
                TargetComponent  = "ViewDashboardMethods",
                TargetFile       = "PageActions/ViewDashboardMethods.cs",
                ComponentType    = "PageActions",
                ExistingMemberName = "UpdateAddressAsync",
                Confidence       = 0.7
            }
        };

        var plan = harness.CreatePlan(decisions);

        Assert.Single(plan.Changes);
        Assert.Equal("EXTEND", plan.Changes[0].Action);
        Assert.NotEmpty(plan.AffectedFiles);
    }

    [Fact]
    public void CreatePlan_CreateDecision_ProducesCreateChange()
    {
        var decisions = new List<ReuseDecision>
        {
            new ReuseDecision
            {
                Decision         = ReuseDecisionType.Create,
                TargetComponent  = "CustomerMethods",
                ComponentType    = "PageActions",
                ExistingMemberName = "UpdateCustomerAddressAsync",
                Confidence       = 0.6
            }
        };

        var plan = harness.CreatePlan(decisions);

        Assert.Single(plan.Changes);
        Assert.Equal("CREATE", plan.Changes[0].Action);
        Assert.True(plan.Changes[0].ValidationRequired);
    }

    [Fact]
    public void CreatePlan_OrdersChanges_ReuseBeforeExtendBeforeCreate()
    {
        var decisions = new List<ReuseDecision>
        {
            new ReuseDecision { Decision = ReuseDecisionType.Create,  TargetComponent = "NewPage",  ComponentType = "PageActions", Confidence = 0.6 },
            new ReuseDecision { Decision = ReuseDecisionType.Reuse,   TargetComponent = "Existing", ComponentType = "PageActions", Confidence = 0.9, ExistingMemberName = "ExistingMethod" },
            new ReuseDecision { Decision = ReuseDecisionType.Extend,  TargetComponent = "Related",  ComponentType = "PageActions", Confidence = 0.7, TargetFile = "PageActions/Related.cs" }
        };

        var plan = harness.CreatePlan(decisions);

        Assert.Equal("REUSE",  plan.Changes[0].Action);
        Assert.Equal("EXTEND", plan.Changes[1].Action);
        Assert.Equal("CREATE", plan.Changes[2].Action);
    }

    [Fact]
    public void CreatePlan_DuplicateDecision_DeduplicatedInChanges()
    {
        var decisions = new List<ReuseDecision>
        {
            new ReuseDecision { Decision = ReuseDecisionType.Reuse, TargetComponent = "PageA", ComponentType = "PageActions", ExistingMemberName = "Method1", Confidence = 0.9 },
            new ReuseDecision { Decision = ReuseDecisionType.Reuse, TargetComponent = "PageA", ComponentType = "PageActions", ExistingMemberName = "Method1", Confidence = 0.9 }
        };

        var plan = harness.CreatePlan(decisions);

        Assert.Single(plan.Changes); // Deduplicated
    }

    [Fact]
    public void CreatePlan_CalculatesOverallConfidence()
    {
        var decisions = new List<ReuseDecision>
        {
            new ReuseDecision { Decision = ReuseDecisionType.Reuse, TargetComponent = "A", ComponentType = "PageActions", ExistingMemberName = "MethodA", Confidence = 0.9 },
            new ReuseDecision { Decision = ReuseDecisionType.Create, TargetComponent = "B", ComponentType = "PageActions", ExistingMemberName = "MethodB", Confidence = 0.6 }
        };

        var plan = harness.CreatePlan(decisions);

        Assert.Equal(0.75, plan.OverallConfidence, 2);
    }
}

/// <summary>Test harness that wires real ImplementationPlanner with FrameworkLayerMapper.</summary>
internal class ImplementationPlannerTestHarness
{
    private readonly ImplementationPlanner planner = new(new FrameworkLayerMapper());

    public ImplementationPlan CreatePlan(List<ReuseDecision> decisions) =>
        planner.CreatePlan(
            new List<BusinessFlowModel> { new BusinessFlowModel { Name = "TestFlow" } },
            decisions,
            new RepositoryMetadata(),
            Path.GetTempPath());
}
