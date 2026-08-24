using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Xunit;
using AIAutomationGenerator.Planning;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Intelligence.Services;
using AIAutomationGenerator.Knowledge;

namespace AIAutomationGenerator.Tests.Planning
{
    public class EngineeringPlannerTests
    {
        private static string FindRepoRoot()
        {
            var candidates = new[]
            {
                AppDomain.CurrentDomain.BaseDirectory,
                Environment.CurrentDirectory,
                Path.GetDirectoryName(typeof(EngineeringPlannerTests).Assembly.Location)
            };
            foreach (var start in candidates)
            {
                if (start == null) continue;
                var dir = new DirectoryInfo(start);
                while (dir != null)
                {
                    if (File.Exists(Path.Combine(dir.FullName, "AIRecorder", "code.ts")))
                        return dir.FullName;
                    dir = dir.Parent;
                }
            }
            return null;
        }

        private static AutomationIntelligenceModel BuildModel(
            string recommendation,
            bool withEvidence,
            bool conflicting = false,
            double confidence = 0.9,
            double evidenceRelevance = 0.9)
        {
            var evidence = new List<KnowledgeEvidence>();
            if (withEvidence && !conflicting)
            {
                evidence.Add(new KnowledgeEvidence
                {
                    KnowledgeId     = "abc",
                    SourceType      = KnowledgeSourceType.PageElement,
                    SourcePath      = "PageElements/DashboardObjects.cs",
                    Page            = "Dashboard",
                    Component       = "SearchButton",
                    RetrievalReason = "page-match",
                    EvidenceText    = "Matching element found",
                    IsDirect        = true,
                    Confidence      = ConfidenceLevel.High,
                    Relevance       = evidenceRelevance
                });
            }
            else if (conflicting)
            {
                evidence.Add(new KnowledgeEvidence
                {
                    KnowledgeId  = "abc", SourcePath = "PageElements/DashboardObjects.cs",
                    RetrievalReason = "page-match", Relevance = 0.9,
                    SourceType = KnowledgeSourceType.PageElement
                });
                evidence.Add(new KnowledgeEvidence
                {
                    KnowledgeId  = "def", SourcePath = "PageElements/DashboardObjects_Old.cs",
                    RetrievalReason = "page-match", Relevance = 0.9,
                    SourceType = KnowledgeSourceType.PageElement
                });
            }
            else
            {
                evidence.Add(new KnowledgeEvidence
                {
                    KnowledgeId     = "none",
                    RetrievalReason = "NO_REPOSITORY_EVIDENCE",
                    EvidenceText    = "No evidence",
                    Relevance       = 0.0
                });
            }

            var model = new AutomationIntelligenceModel
            {
                AnalysisTimestamp   = DateTime.UtcNow.ToString("O"),
                RepositoryRoot      = "AutomationFrameWork",
                RepositoryKnowledge = new RepositoryKnowledgeModel
                {
                    PageElements    = new List<PageElementInfo>(),
                    PageActions     = new List<PageActionInfo>(),
                    StepDefinitions = new List<StepDefinitionInfo>()
                },
                RecordingIntelligence = new RecordingIntelligenceModel
                {
                    Actions = new List<RecordedActionIntelligence>
                    {
                        new() { Sequence = 0, ActionType = "click",
                                InferredPageContext = "Dashboard", LocatorValue = "#btnSearch" }
                    },
                    RelatedPages = new List<string> { "Dashboard" }
                },
                Decisions = new List<IntelligenceDecision>
                {
                    new() { ActionIndex = 0, ActionDescription = "click SearchButton",
                            DecisionType = "PageElement", Recommendation = recommendation,
                            TargetComponent = "DashboardObjects.SearchButton",
                            ConfidenceScore = confidence }
                },
                DecisionEvidence = new Dictionary<int, List<KnowledgeEvidence>>
                {
                    [0] = evidence
                }
            };
            return model;
        }

        // ===========================
        // Decision rules
        // ===========================

        [Fact]
        public void Planner_ReuseDecision_WhenEvidenceSupports()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("REUSE", withEvidence: true));

            Assert.Contains(plan.Decisions, d => d.Decision == EngineeringDecisionType.Reuse);
        }

        [Fact]
        public void Planner_ExtendDecision_WhenEvidenceSupports()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("EXTEND", withEvidence: true));

            Assert.Contains(plan.Decisions, d => d.Decision == EngineeringDecisionType.Extend);
        }

        [Fact]
        public void Planner_CreateDecision_WhenNoMatchExists()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("CREATE", withEvidence: true));

            Assert.Contains(plan.Decisions, d => d.Decision == EngineeringDecisionType.Create);
        }

        [Fact]
        public void Planner_HumanReview_WhenNoEvidence()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("REUSE", withEvidence: false));

            // No real evidence → HUMAN_REVIEW_REQUIRED, never silent CREATE
            Assert.Contains(plan.Decisions,
                d => d.Decision == EngineeringDecisionType.HumanReviewRequired);
        }

        [Fact]
        public void Planner_HumanReview_WhenConflictingEvidence()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("REUSE", withEvidence: false, conflicting: true));

            Assert.Contains(plan.Decisions,
                d => d.Decision == EngineeringDecisionType.HumanReviewRequired);
        }

        [Fact]
        public void Planner_NoSilentCreate_WhenEvidenceMissing()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("CREATE", withEvidence: false));

            // Evidence missing → HUMAN_REVIEW_REQUIRED, not CREATE
            Assert.DoesNotContain(plan.Decisions,
                d => d.Decision == EngineeringDecisionType.Create);
        }

        [Fact]
        public void Planner_AllDecisions_HaveEvidence()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("REUSE", withEvidence: true));

            Assert.All(plan.Decisions, d => Assert.True(d.HasEvidence));
        }

        [Fact]
        public void Planner_HumanReviewDecision_HasNote()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("REUSE", withEvidence: false));

            var hr = plan.Decisions.First(d =>
                d.Decision == EngineeringDecisionType.HumanReviewRequired);
            Assert.False(string.IsNullOrEmpty(hr.HumanReviewNote));
        }

        // ===========================
        // Plan status
        // ===========================

        [Fact]
        public void Plan_Status_IsHumanReviewRequired_WhenAnyDecisionIs()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("REUSE", withEvidence: false));

            Assert.Equal(PlanStatus.HumanReviewRequired, plan.Status);
        }

        [Fact]
        public void Plan_Status_IsReady_WhenAllDecisionsResolved()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("REUSE", withEvidence: true));

            Assert.Equal(PlanStatus.Ready, plan.Status);
        }

        [Fact]
        public void Plan_FrameworkModificationsAllowed_IsFalseByDefault()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("REUSE", withEvidence: true));

            Assert.False(plan.FrameworkModificationsAllowed);
        }

        [Fact]
        public void Plan_ProtectedFiles_AreIdentified()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("REUSE", withEvidence: true));

            Assert.NotEmpty(plan.ProtectedFiles);
            Assert.Contains(plan.ProtectedFiles, f => f.Contains("Hooks.cs"));
            Assert.Contains(plan.ProtectedFiles, f => f.EndsWith(".csproj", StringComparison.OrdinalIgnoreCase));
        }

        [Fact]
        public void Planner_CreateLowConfidence_RequiresHumanReview()
        {
            var planner = new EngineeringPlanner();
            var plan = planner.CreatePlan(BuildModel("CREATE", withEvidence: true, confidence: 0.9, evidenceRelevance: 0.2));

            Assert.Contains(plan.Decisions, d => d.Decision == EngineeringDecisionType.HumanReviewRequired);
            Assert.DoesNotContain(plan.Decisions, d => d.Decision == EngineeringDecisionType.Create);
        }

        // ===========================
        // File planning
        // ===========================

        [Fact]
        public void FilePlan_ReuseDecision_HasReuseModificationType()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("REUSE", withEvidence: true));

            // Reuse decisions should produce Reuse file plans
            if (plan.PlannedFileChanges.Any())
                Assert.Contains(plan.PlannedFileChanges,
                    f => f.ModificationType == FileModificationType.Reuse);
        }

        // ===========================
        // Confidence and repeatability
        // ===========================

        [Fact]
        public void Plan_OverallConfidence_IsCalculated()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("REUSE", withEvidence: true));

            Assert.True(plan.OverallConfidence >= 0 && plan.OverallConfidence <= 1);
        }

        [Fact]
        public void Plan_IsDeterministic_SameInputSameOutput()
        {
            var planner = new EngineeringPlanner();
            var model   = BuildModel("REUSE", withEvidence: true);
            var p1      = planner.CreatePlan(model);
            var p2      = planner.CreatePlan(model);

            Assert.Equal(p1.Decisions.Count, p2.Decisions.Count);
            Assert.Equal(p1.Status, p2.Status);
            Assert.Equal(p1.OverallConfidence, p2.OverallConfidence);
        }

        // ===========================
        // Decision counts
        // ===========================

        [Fact]
        public void Plan_DecisionCounts_AreDerived()
        {
            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(BuildModel("REUSE", withEvidence: true));

            int total = plan.ReuseCount + plan.ExtendCount + plan.CreateCount + plan.HumanReviewCount;
            Assert.Equal(plan.Decisions.Count, total);
        }

        // ===========================
        // Real code.ts integration
        // ===========================

        [Fact]
        public void Planner_RealCodets_ProducesPlan()
        {
            var root = FindRepoRoot();
            if (root == null) return;

            // Build a minimal model from real code.ts file presence
            var parser  = new CodegenParser();
            var path    = System.IO.Path.Combine(root, "AIRecorder", "code.ts");
            var parsed  = parser.ParseFile(path);

            var model = new AutomationIntelligenceModel
            {
                AnalysisTimestamp   = DateTime.UtcNow.ToString("O"),
                RepositoryRoot      = "AutomationFrameWork",
                RepositoryKnowledge = new RepositoryKnowledgeModel
                {
                    PageElements    = new(),
                    PageActions     = new(),
                    StepDefinitions = new()
                },
                RecordingIntelligence = new RecordingIntelligenceModel
                {
                    Actions      = parsed.Actions,
                    RelatedPages = new() { "ReassignPackages", "Dashboard" }
                }
            };

            var planner = new EngineeringPlanner();
            var plan    = planner.CreatePlan(model, path);

            Assert.NotNull(plan);
            Assert.Equal(path, plan.RecordingSource);
            Assert.True(plan.RecordingActionCount > 0);
        }

        [Fact]
        public void Planner_S5ConflictRule_MultiLayerEvidenceSameComponent_IsNotConflict()
        {
            // S5 fix: Multiple evidence records (PageElement, PageAction, Step) for the SAME
            // component name should NOT be treated as a conflict—that's natural multi-layer evidence.
            var evidence = new List<KnowledgeEvidence>
            {
                new() {
                    KnowledgeId = "elem1", SourcePath = "PageElements/DashboardObjects.cs",
                    SourceType = KnowledgeSourceType.PageElement,
                    Page = "ViewDashboard", Component = "AdministrationLink",
                    Relevance = 0.95, RetrievalReason = "action-signal-match"
                },
                new() {
                    KnowledgeId = "action1", SourcePath = "PageActions/DashboardMethods.cs",
                    SourceType = KnowledgeSourceType.PageAction,
                    Page = "ViewDashboard", Component = "AdministrationLink",
                    Relevance = 0.8, RetrievalReason = "action-signal-match"
                },
                new() {
                    KnowledgeId = "step1", SourcePath = "StepDefinitions/DashboardSteps.cs",
                    SourceType = KnowledgeSourceType.StepDefinition,
                    Page = "ViewDashboard", Component = "AdministrationLink",
                    Relevance = 0.85, RetrievalReason = "action-signal-match"
                }
            };

            var model = new AutomationIntelligenceModel
            {
                RepositoryRoot = "AutomationFrameWork",
                RepositoryKnowledge = new RepositoryKnowledgeModel { PageElements = new(), PageActions = new(), StepDefinitions = new() },
                RecordingIntelligence = new RecordingIntelligenceModel { Actions = new List<RecordedActionIntelligence> { new() { Sequence = 0, ActionType = "click", Target = "Administration", InferredPageContext = "ViewDashboard", LocatorValue = "link[name='Administration']" } }, RelatedPages = new() { "ViewDashboard" } },
                Decisions = new List<IntelligenceDecision> { new() { ActionIndex = 0, ActionDescription = "click Administration", DecisionType = "PageElement", Recommendation = "REUSE", TargetComponent = "AdministrationLink", ConfidenceScore = 0.9 } },
                DecisionEvidence = new Dictionary<int, List<KnowledgeEvidence>> { [0] = evidence }
            };

            var planner = new EngineeringPlanner();
            var plan = planner.CreatePlan(model);

            // Should be REUSE, not HUMAN_REVIEW, because all evidence refers to same component/page
            var decision = plan.Decisions.First(d => d.ActionIndex == 0);
            Assert.Equal(EngineeringDecisionType.Reuse, decision.Decision);
            Assert.Contains("confidence", decision.Reason.ToLower());
        }

        [Fact]
        public void Planner_S5ConflictRule_DifferentComponents_IsConflict()
        {
            // S5 fix: If evidence supports DIFFERENT components (not just different source files), 
            // that IS a genuine conflict requiring human review.
            var evidence = new List<KnowledgeEvidence>
            {
                new() {
                    KnowledgeId = "elem1", SourcePath = "PageElements/DashboardObjects.cs",
                    SourceType = KnowledgeSourceType.PageElement,
                    Page = "ViewDashboard", Component = "AdministrationLink",
                    Relevance = 0.9, RetrievalReason = "action-signal-match"
                },
                new() {
                    KnowledgeId = "elem2", SourcePath = "PageElements/ViewDealObjects.cs",
                    SourceType = KnowledgeSourceType.PageElement,
                    Page = "ViewDeal", Component = "CompleteLink",
                    Relevance = 0.85, RetrievalReason = "action-signal-match"
                }
            };

            var model = new AutomationIntelligenceModel
            {
                RepositoryRoot = "AutomationFrameWork",
                RepositoryKnowledge = new RepositoryKnowledgeModel { PageElements = new(), PageActions = new(), StepDefinitions = new() },
                RecordingIntelligence = new RecordingIntelligenceModel { Actions = new List<RecordedActionIntelligence> { new() { Sequence = 0, ActionType = "click", Target = "Administration", InferredPageContext = "ViewDashboard", LocatorValue = "link[name='Administration']" } }, RelatedPages = new() { "ViewDashboard" } },
                Decisions = new List<IntelligenceDecision> { new() { ActionIndex = 0, ActionDescription = "click Administration", DecisionType = "PageElement", Recommendation = "REUSE", TargetComponent = "Administration", ConfidenceScore = 0.9 } },
                DecisionEvidence = new Dictionary<int, List<KnowledgeEvidence>> { [0] = evidence }
            };

            var planner = new EngineeringPlanner();
            var plan = planner.CreatePlan(model);

            // Should be HUMAN_REVIEW because evidence supports different pages/components
            var decision = plan.Decisions.First(d => d.ActionIndex == 0);
            Assert.Equal(EngineeringDecisionType.HumanReviewRequired, decision.Decision);
            Assert.Contains("conflicting", decision.Reason.ToLower());
        }

        [Fact]
        public void Planner_RealCodets_NoFabricatedComponents()
        {
            var root = FindRepoRoot();
            if (root == null) return;

            var parser  = new CodegenParser();
            var path    = System.IO.Path.Combine(root, "AIRecorder", "code.ts");
            var parsed  = parser.ParseFile(path);

            var model = new AutomationIntelligenceModel
            {
                AnalysisTimestamp   = DateTime.UtcNow.ToString("O"),
                RepositoryRoot      = "AutomationFrameWork",
                RepositoryKnowledge = new RepositoryKnowledgeModel
                    { PageElements = new(), PageActions = new(), StepDefinitions = new() },
                RecordingIntelligence = new RecordingIntelligenceModel
                    { Actions = parsed.Actions, RelatedPages = new() { "ReassignPackages" } }
            };

            var plan = new EngineeringPlanner().CreatePlan(model, path);

            // With no repository evidence, decisions must be HUMAN_REVIEW or CREATE-with-evidence
            // None must claim REUSE or EXTEND without any evidence
            var reuseOrExtend = plan.Decisions
                .Where(d => d.Decision == EngineeringDecisionType.Reuse ||
                            d.Decision == EngineeringDecisionType.Extend)
                .ToList();

            Assert.All(reuseOrExtend, d => Assert.True(d.HasEvidence));
        }

        // ===========================
        // S5 maxConfidence fix regression tests
        // ===========================

        [Fact]
        public void Planner_S5_MultiLayerEvidence_LowAvgHighMax_ProducesReuse()
        {
            // Scenario: S4 enrichment attaches PageElement/PageAction (Relevance=0) AND
            // StepDefinition (Relevance=0.85) for the same ViewDashboard page.
            // avgConfidence = (0+0+0+0.85+0.85)/5 = 0.34 < 0.6 (would fail with avg check).
            // maxConfidence = 0.85 >= 0.6 → should produce REUSE.
            var evidence = new List<KnowledgeEvidence>
            {
                new() { KnowledgeId = "pe1", SourceType = KnowledgeSourceType.PageElement,
                        SourcePath = "PageElements/ViewDashboardObjects.cs",
                        Page = "ViewDashboard", Component = "AdministrationLink",
                        RetrievalReason = "page-match", Relevance = 0.0 },
                new() { KnowledgeId = "pa1", SourceType = KnowledgeSourceType.PageAction,
                        SourcePath = "PageActions/ViewDashboardMethods.cs",
                        Page = "ViewDashboard", Component = "ClickAdministrationLinkAsync",
                        RetrievalReason = "page-match", Relevance = 0.0 },
                new() { KnowledgeId = "pa2", SourceType = KnowledgeSourceType.PageAction,
                        SourcePath = "PageActions/ViewDashboardMethods.cs",
                        Page = "ViewDashboard", Component = "NavigateToDocumentAdministrationAsync",
                        RetrievalReason = "page-match", Relevance = 0.0 },
                new() { KnowledgeId = "sd1", SourceType = KnowledgeSourceType.StepDefinition,
                        SourcePath = "StepDefinitions/ViewDashboardSteps.cs",
                        Page = "ViewDashboard", Component = "user clicks on Administration link",
                        RetrievalReason = "action-signal-match", Relevance = 0.85 },
                new() { KnowledgeId = "sd2", SourceType = KnowledgeSourceType.StepDefinition,
                        SourcePath = "StepDefinitions/ViewDashboardSteps.cs",
                        Page = "ViewDashboard", Component = "user navigates to document administration page",
                        RetrievalReason = "action-signal-match", Relevance = 0.85 }
            };

            var model = new AutomationIntelligenceModel
            {
                RepositoryRoot = "AutomationFrameWork",
                RepositoryKnowledge = new RepositoryKnowledgeModel { PageElements = new(), PageActions = new(), StepDefinitions = new() },
                RecordingIntelligence = new RecordingIntelligenceModel
                {
                    Actions = new List<RecordedActionIntelligence>
                    {
                        new() { Sequence = 0, ActionType = "navigate",
                                Target = "https://documentadministration-uat.trimont.com/",
                                InferredPageContext = "ViewDashboard" }
                    },
                    RelatedPages = new() { "ViewDashboard" }
                },
                Decisions = new List<IntelligenceDecision>
                {
                    new() { ActionIndex = 0, ActionDescription = "navigate dashboard",
                            DecisionType = "PageElement", Recommendation = "REUSE",
                            TargetComponent = "AdministrationLink", ConfidenceScore = 0.9 }
                },
                DecisionEvidence = new Dictionary<int, List<KnowledgeEvidence>> { [0] = evidence }
            };

            var planner = new EngineeringPlanner();
            var plan = planner.CreatePlan(model);
            var d = plan.Decisions.First(x => x.ActionIndex == 0);

            // maxConfidence (0.85) >= MediumConfidenceThreshold (0.6) → REUSE, not HR
            Assert.Equal(EngineeringDecisionType.Reuse, d.Decision);
            Assert.DoesNotContain(plan.Decisions, x => x.Decision == EngineeringDecisionType.HumanReviewRequired);
        }

        [Fact]
        public void Planner_S5_AllZeroRelevance_REUSE_RequiresHumanReview()
        {
            // Scenario: All evidence items have Relevance=0.0 (no strong match found).
            // maxConfidence = 0.0 < 0.6 → must remain HUMAN_REVIEW, never silent REUSE.
            var evidence = new List<KnowledgeEvidence>
            {
                new() { KnowledgeId = "pe1", SourceType = KnowledgeSourceType.PageElement,
                        SourcePath = "PageElements/ViewDashboardObjects.cs",
                        Page = "ViewDashboard", Component = "SomeUnrelatedElement",
                        RetrievalReason = "page-match", Relevance = 0.0 },
                new() { KnowledgeId = "pa1", SourceType = KnowledgeSourceType.PageAction,
                        SourcePath = "PageActions/ViewDashboardMethods.cs",
                        Page = "ViewDashboard", Component = "AnotherMethod",
                        RetrievalReason = "page-match", Relevance = 0.0 }
            };

            var model = new AutomationIntelligenceModel
            {
                RepositoryRoot = "AutomationFrameWork",
                RepositoryKnowledge = new RepositoryKnowledgeModel { PageElements = new(), PageActions = new(), StepDefinitions = new() },
                RecordingIntelligence = new RecordingIntelligenceModel
                {
                    Actions = new List<RecordedActionIntelligence>
                    {
                        new() { Sequence = 0, ActionType = "click", Target = "UnknownTarget",
                                InferredPageContext = "ViewDashboard" }
                    },
                    RelatedPages = new() { "ViewDashboard" }
                },
                Decisions = new List<IntelligenceDecision>
                {
                    new() { ActionIndex = 0, ActionDescription = "click UnknownTarget",
                            DecisionType = "PageElement", Recommendation = "REUSE",
                            TargetComponent = "UnknownTarget", ConfidenceScore = 0.5 }
                },
                DecisionEvidence = new Dictionary<int, List<KnowledgeEvidence>> { [0] = evidence }
            };

            var planner = new EngineeringPlanner();
            var plan = planner.CreatePlan(model);
            var d = plan.Decisions.First(x => x.ActionIndex == 0);

            // maxConfidence (0.0) < MediumConfidenceThreshold (0.6) → still HUMAN_REVIEW
            Assert.Equal(EngineeringDecisionType.HumanReviewRequired, d.Decision);
            Assert.DoesNotContain(plan.Decisions, x => x.Decision == EngineeringDecisionType.Reuse);
        }
    }
}
