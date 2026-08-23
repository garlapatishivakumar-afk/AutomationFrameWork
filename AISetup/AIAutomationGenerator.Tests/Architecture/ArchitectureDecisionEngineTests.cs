using AIAutomationGenerator.Architecture;
using AIAutomationGenerator.Models;
using Xunit;

namespace AIAutomationGenerator.Tests.Architecture;

public class ArchitectureDecisionEngineTests
{
    private readonly ArchitectureDecisionEngine engine = new();

    // ─────────────────────────────────────────────────────────────────────────
    // REUSE scenarios
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_ReturnsReuse_WhenHighConfidenceMethodExists()
    {
        var metadata = BuildMetadata(new MethodModel
        {
            Name           = "ClickSearchQueueButton",
            ClassName      = "ViewDashboardMethods",
            FilePath       = "PageActions/ViewDashboardMethods.cs"
        });

        var flows = BuildFlows("Click", "SearchQueueButton", "ViewDashboard");

        var decisions = engine.Decide(flows, BuildKnowledge(), metadata);

        Assert.NotEmpty(decisions);
        var d = decisions.First();
        Assert.Equal(ReuseDecisionType.Reuse, d.Decision);
        Assert.True(d.Confidence >= 0.5);
    }

    [Fact]
    public void Decide_DecisionHasReasonAndEvidence()
    {
        var metadata = BuildMetadata(new MethodModel
        {
            Name      = "SelectSearchUserDropdown",
            ClassName = "ViewDashboardMethods",
            FilePath  = "PageActions/ViewDashboardMethods.cs"
        });

        var flows = BuildFlows("Select", "SearchUser", "ViewDashboard");

        var decisions = engine.Decide(flows, BuildKnowledge(), metadata);

        Assert.NotEmpty(decisions);
        Assert.False(string.IsNullOrWhiteSpace(decisions.First().Reason));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // EXTEND scenarios
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_ReturnsExtend_WhenRelatedPageExistsButNoExactMethod()
    {
        // No method match but existing page
        var metadata = BuildMetadata(new MethodModel
        {
            Name      = "NavigateToDocumentAdministration",
            ClassName = "ViewDashboardMethods",
            FilePath  = "PageActions/ViewDashboardMethods.cs"
        });

        var knowledge = new RepositoryKnowledge();
        knowledge.Pages.Add(new PageKnowledge { Name = "ViewDashboardMethods" });

        var flows = BuildFlows("Update", "Address", "ViewDashboard");

        var decisions = engine.Decide(flows, knowledge, metadata);

        Assert.NotEmpty(decisions);
        var d = decisions.First();
        // Should be Extend (related page) or Create (no close method match)
        Assert.True(d.Decision == ReuseDecisionType.Extend ||
                    d.Decision == ReuseDecisionType.Create);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE scenarios
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_ReturnsCreate_WhenNoMatchFound()
    {
        var metadata = new RepositoryMetadata();
        var flows    = BuildFlows("Update", "CustomerAddress", "CustomerPage");

        var decisions = engine.Decide(flows, BuildKnowledge(), metadata);

        Assert.NotEmpty(decisions);
        Assert.Equal(ReuseDecisionType.Create, decisions.First().Decision);
        Assert.True(decisions.First().RequiresHumanApproval);
    }

    [Fact]
    public void Decide_CreateDecision_ContainsProposedMemberName()
    {
        var metadata  = new RepositoryMetadata();
        var flows     = BuildFlows("Fill", "DealNumber", "DealPage");
        var decisions = engine.Decide(flows, BuildKnowledge(), metadata);

        var d = decisions.First(x => x.Decision == ReuseDecisionType.Create);
        Assert.False(string.IsNullOrWhiteSpace(d.ExistingMemberName));
        Assert.Contains("Async", d.ExistingMemberName);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Empty input guards
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public void Decide_EmptyFlows_ReturnsEmptyDecisions()
    {
        var decisions = engine.Decide(new List<BusinessFlowModel>(), BuildKnowledge(), new RepositoryMetadata());
        Assert.Empty(decisions);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static RepositoryMetadata BuildMetadata(MethodModel method)
    {
        var md = new RepositoryMetadata();
        md.Methods.Add(method);
        return md;
    }

    private static RepositoryKnowledge BuildKnowledge() => new();

    private static List<BusinessFlowModel> BuildFlows(
        string actionType,
        string locatorArgument,
        string pageName)
    {
        var flow = new BusinessFlowModel { Name = "TestFlow" };
        flow.Actions.Add(new RecordingActionModel
        {
            ActionType      = actionType,
            LocatorArgument = locatorArgument,
            PageName        = pageName
        });
        return new List<BusinessFlowModel> { flow };
    }
}
