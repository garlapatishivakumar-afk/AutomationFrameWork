using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Knowledge;
using AIAutomationGenerator.Planning;

namespace AIAutomationGenerator.Tests.Planning
{
    /// <summary>
    /// Focused tests for the HumanApprovalService.
    ///
    /// These tests verify that:
    ///   1. The approval service only modifies HUMAN_REVIEW_REQUIRED decisions.
    ///   2. It rejects approvals with missing ApprovedBy or Rationale.
    ///   3. It only promotes plan to Ready when ALL HR decisions are resolved.
    ///   4. It never modifies non-HR decisions.
    ///   5. The S5 safety gate is NOT weakened by the service.
    /// </summary>
    public class HumanApprovalServiceTests
    {
        private static EngineeringPlan BuildPlanWithMixedDecisions(int reuseCount, int hrCount)
        {
            var decisions = new List<EngineeringDecision>();
            for (int i = 0; i < reuseCount; i++)
            {
                decisions.Add(new EngineeringDecision
                {
                    ActionIndex  = i,
                    ActionDescription = $"REUSE action {i}",
                    Decision     = EngineeringDecisionType.Reuse,
                    Component    = $"ReuseComponent{i}",
                    SourcePath   = $"PageElements/ReuseComponent{i}.cs",
                    Confidence   = 0.85,
                    Reason       = "Existing component matches.",
                    Evidence     = new List<KnowledgeEvidence>
                    {
                        new() { KnowledgeId = $"ev{i}", Relevance = 0.85 }
                    }
                });
            }
            for (int i = reuseCount; i < reuseCount + hrCount; i++)
            {
                decisions.Add(new EngineeringDecision
                {
                    ActionIndex  = i,
                    ActionDescription = $"HR action {i}",
                    Decision     = EngineeringDecisionType.HumanReviewRequired,
                    Component    = $"AmbiguousComponent{i}",
                    HumanReviewNote = $"Conflicting evidence for action {i}",
                    Confidence   = 0.3,
                    Reason       = "Conflicting pages.",
                    Evidence     = new List<KnowledgeEvidence>
                    {
                        new() { KnowledgeId = $"hr{i}", Relevance = 0.0 }
                    }
                });
            }

            return new EngineeringPlan
            {
                PlanId    = "test-plan",
                Status    = PlanStatus.HumanReviewRequired,
                Decisions = decisions,
                HumanReviewReasons = Enumerable.Range(0, hrCount)
                    .Select(i => $"HR reason {i}").ToList(),
                PlannedFileChanges = new List<FilePlan>()
            };
        }

        private static HumanApprovalRecord MakeApproval(int actionIndex, string approvedBy = "QA.Lead")
            => new()
            {
                ActionIndex        = actionIndex,
                ActionDescription  = $"HR action {actionIndex}",
                ResolvedComponent  = $"ViewDashboard.Component{actionIndex}",
                ResolvedSourcePath = $"PageElements/ViewDashboardObjects.cs",
                ResolvedPage       = "ViewDashboard",
                ResolvedMethod     = $"ClickComponent{actionIndex}Async",
                ResolvedDecisionType = EngineeringDecisionType.Reuse,
                Rationale = "Selector is exact match; page context confirmed by workflow.",
                ApprovedBy = approvedBy,
                ApprovedAt = DateTime.UtcNow
            };

        // ===========================
        // Core approval logic
        // ===========================

        [Fact]
        public void ApprovalService_ApprovesAllHR_PromotesPlanToReady()
        {
            var plan = BuildPlanWithMixedDecisions(reuseCount: 7, hrCount: 5);
            Assert.Equal(PlanStatus.HumanReviewRequired, plan.Status);
            Assert.Equal(5, plan.HumanReviewCount);

            var approvals = Enumerable.Range(7, 5).Select(i => MakeApproval(i)).ToList();
            var svc = new HumanApprovalService();
            var result = svc.Apply(plan, approvals);

            Assert.True(result.PlanPromotedToReady, "Plan should be promoted to Ready.");
            Assert.True(result.AllApproved);
            Assert.Equal(PlanStatus.Ready, plan.Status);
            Assert.Equal(0, plan.HumanReviewCount);
            Assert.Equal(5, result.Applied.Count);
            Assert.Empty(result.Rejected);
        }

        [Fact]
        public void ApprovalService_PartialApprovals_PlanRemainsHR()
        {
            var plan = BuildPlanWithMixedDecisions(reuseCount: 7, hrCount: 5);

            // Only approve 4 of 5 HR decisions
            var approvals = Enumerable.Range(7, 4).Select(i => MakeApproval(i)).ToList();
            var svc = new HumanApprovalService();
            var result = svc.Apply(plan, approvals);

            Assert.False(result.PlanPromotedToReady);
            Assert.Equal(PlanStatus.HumanReviewRequired, plan.Status);
            Assert.Equal(1, plan.HumanReviewCount);
            Assert.Equal(4, result.Applied.Count);
            Assert.Equal(1, result.RemainingHRCount);
        }

        [Fact]
        public void ApprovalService_MissingApprovedBy_RejectsApproval()
        {
            var plan = BuildPlanWithMixedDecisions(reuseCount: 0, hrCount: 1);
            var approval = MakeApproval(0);
            approval.ApprovedBy = "";  // missing

            var svc = new HumanApprovalService();
            var result = svc.Apply(plan, new[] { approval });

            Assert.False(result.PlanPromotedToReady);
            Assert.Empty(result.Applied);
            Assert.Single(result.Rejected);
            Assert.Contains("ApprovedBy", result.Rejected[0].Reason);
        }

        [Fact]
        public void ApprovalService_MissingRationale_RejectsApproval()
        {
            var plan = BuildPlanWithMixedDecisions(reuseCount: 0, hrCount: 1);
            var approval = MakeApproval(0);
            approval.Rationale = "";  // missing

            var svc = new HumanApprovalService();
            var result = svc.Apply(plan, new[] { approval });

            Assert.False(result.PlanPromotedToReady);
            Assert.Empty(result.Applied);
            Assert.Single(result.Rejected);
            Assert.Contains("Rationale", result.Rejected[0].Reason);
        }

        [Fact]
        public void ApprovalService_ApprovalTargetingNonHRDecision_IsRejected()
        {
            var plan = BuildPlanWithMixedDecisions(reuseCount: 3, hrCount: 1);

            // Try to approve a REUSE decision (index 0) — should be rejected
            var approval = MakeApproval(0);

            var svc = new HumanApprovalService();
            var result = svc.Apply(plan, new[] { approval });

            Assert.Empty(result.Applied);
            Assert.Single(result.Rejected);
            Assert.Contains("not flagged as HUMAN_REVIEW_REQUIRED", result.Rejected[0].Reason);
            // The REUSE decision must NOT be changed
            Assert.Equal(EngineeringDecisionType.Reuse, plan.Decisions[0].Decision);
        }

        [Fact]
        public void ApprovalService_ApprovalForNonExistentAction_IsRejected()
        {
            var plan = BuildPlanWithMixedDecisions(reuseCount: 1, hrCount: 1);
            var approval = MakeApproval(99);  // action 99 doesn't exist

            var svc = new HumanApprovalService();
            var result = svc.Apply(plan, new[] { approval });

            Assert.Empty(result.Applied);
            Assert.Single(result.Rejected);
            Assert.Contains("not found", result.Rejected[0].Reason);
        }

        [Fact]
        public void ApprovalService_ApprovedDecision_HasCorrectAuditTrail()
        {
            var plan = BuildPlanWithMixedDecisions(reuseCount: 0, hrCount: 1);
            var approval = MakeApproval(0, approvedBy: "shivakumar.garlapati");

            var svc = new HumanApprovalService();
            var result = svc.Apply(plan, new[] { approval });

            Assert.True(result.PlanPromotedToReady);
            var applied = result.Applied[0];
            Assert.Equal("shivakumar.garlapati", applied.ApprovedBy);
            Assert.Equal("ViewDashboard.Component0", applied.ResolvedComponent);
            Assert.NotEmpty(applied.Rationale);

            // Decision must carry the approval in its Reason field
            var decision = plan.Decisions[0];
            Assert.Contains("Human-approved", decision.Reason);
            Assert.Contains("shivakumar.garlapati", decision.Reason);
            Assert.Equal(EngineeringDecisionType.Reuse, decision.Decision);
            Assert.Equal(1.0, decision.Confidence);
            Assert.Null(decision.HumanReviewNote);  // cleared
        }

        [Fact]
        public void ApprovalService_NoApprovals_ReturnsSafeDefault()
        {
            var plan = BuildPlanWithMixedDecisions(reuseCount: 0, hrCount: 2);
            var svc = new HumanApprovalService();
            var result = svc.Apply(plan, new List<HumanApprovalRecord>());

            Assert.False(result.PlanPromotedToReady);
            Assert.Empty(result.Applied);
            Assert.Equal(PlanStatus.HumanReviewRequired, plan.Status);  // unchanged
        }

        [Fact]
        public void ApprovalService_ReuseDecisions_AreNeverTouched()
        {
            var plan = BuildPlanWithMixedDecisions(reuseCount: 7, hrCount: 5);
            var approvals = Enumerable.Range(7, 5).Select(i => MakeApproval(i)).ToList();

            var svc = new HumanApprovalService();
            svc.Apply(plan, approvals);

            // All 7 REUSE decisions must still be Reuse with original confidence
            var reuseDecisions = plan.Decisions.Where(d => d.ActionIndex < 7).ToList();
            Assert.Equal(7, reuseDecisions.Count);
            Assert.All(reuseDecisions, d =>
            {
                Assert.Equal(EngineeringDecisionType.Reuse, d.Decision);
                Assert.Equal(0.85, d.Confidence);
                Assert.DoesNotContain("Human-approved", d.Reason);
            });
        }

        // ===========================
        // S5 safety gate remains intact
        // ===========================

        [Fact]
        public void S5SafetyGate_StillFlagsHR_BeforeApprovalServiceRuns()
        {
            // S5 must still produce HumanReviewRequired — the approval service
            // is a post-S5 step. This test uses the planner directly to confirm
            // the gate is unchanged.
            var planner = new EngineeringPlanner();

            // Build a model with conflicting evidence (2 pages)
            var evidence = new List<KnowledgeEvidence>
            {
                new() { KnowledgeId = "e1", Page = "ViewDashboard", Component = "AdministrationLink",
                        SourcePath = "PageElements/ViewDashboardObjects.cs",
                        Relevance = 0.0, RetrievalReason = "page-match",
                        SourceType = KnowledgeSourceType.PageElement },
                new() { KnowledgeId = "e2", Page = "ViewDeal", Component = "CompleteLink",
                        SourcePath = "PageElements/ViewDealObjects.cs",
                        Relevance = 0.0, RetrievalReason = "page-match",
                        SourceType = KnowledgeSourceType.PageElement }
            };

            var model = new AutomationIntelligenceModel
            {
                RepositoryRoot = "Test",
                RepositoryKnowledge = new RepositoryKnowledgeModel
                    { PageElements = new(), PageActions = new(), StepDefinitions = new() },
                RecordingIntelligence = new RecordingIntelligenceModel
                {
                    Actions = new List<RecordedActionIntelligence>
                    {
                        new() { Sequence = 0, ActionType = "click", Target = "Administration",
                                InferredPageContext = "ViewDashboard" }
                    },
                    RelatedPages = new() { "ViewDashboard" }
                },
                Decisions = new List<IntelligenceDecision>
                {
                    new() { ActionIndex = 0, Recommendation = "REUSE",
                            TargetComponent = "Administration", ConfidenceScore = 0.9 }
                },
                DecisionEvidence = new Dictionary<int, List<KnowledgeEvidence>> { [0] = evidence }
            };

            var plan = planner.CreatePlan(model);

            // S5 must still flag this as HR (2 pages = genuine conflict)
            Assert.Equal(PlanStatus.HumanReviewRequired, plan.Status);
            Assert.Equal(1, plan.HumanReviewCount);

            // Now apply human approval
            var approval = new HumanApprovalRecord
            {
                ActionIndex = 0,
                ResolvedComponent = "AdministrationLink",
                ResolvedSourcePath = "PageElements/ViewDashboardObjects.cs",
                ResolvedPage = "ViewDashboard",
                Rationale = "Confirmed via workflow context: selector is exact match on Document Administration page.",
                ApprovedBy = "shivakumar.garlapati"
            };

            var svc = new HumanApprovalService();
            var result = svc.Apply(plan, new[] { approval });

            // Only after explicit human approval should plan become Ready
            Assert.True(result.PlanPromotedToReady);
            Assert.Equal(PlanStatus.Ready, plan.Status);
            Assert.Equal(0, plan.HumanReviewCount);
        }
    }
}
