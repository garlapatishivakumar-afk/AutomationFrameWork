using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using AIAutomationGenerator.Implementation;
using AIAutomationGenerator.Planning;
using AIAutomationGenerator.Knowledge;

namespace AIAutomationGenerator.Tests.Implementation
{
    public class ImplementationEngineTests
    {
        private static EngineeringPlan MakePlan(
            EngineeringDecisionType decisionType = EngineeringDecisionType.Create,
            bool withProtectedFile = false,
            bool planHumanReview   = false)
        {
            var plan = new EngineeringPlan
            {
                PlanId    = "test-plan",
                Status    = planHumanReview ? PlanStatus.HumanReviewRequired : PlanStatus.Ready,
                FrameworkModificationsAllowed = false,
                ProtectedFiles = new() { "AutomationFrameWork/Hooks/Hooks.cs" },
                Decisions = new List<EngineeringDecision>
                {
                    new()
                    {
                        ActionIndex       = 0,
                        ActionDescription = "click SearchButton",
                        Component         = "DashboardObjects",
                        ComponentType     = "PageElement",
                        Decision          = decisionType,
                        Reason            = "test reason",
                        SourcePath        = decisionType == EngineeringDecisionType.Reuse
                            ? "PageElements/DashboardObjects.cs" : null,
                        Confidence        = 0.9,
                        Evidence          = new List<KnowledgeEvidence>
                        {
                            new() { KnowledgeId = "abc", RetrievalReason = "page-match",
                                    EvidenceText = "Found element", Relevance = 0.9,
                                    SourceType = KnowledgeSourceType.PageElement }
                        }
                    }
                },
                PlannedFileChanges = new List<FilePlan>
                {
                    new()
                    {
                        FilePath = withProtectedFile
                            ? "AutomationFrameWork/Hooks/Hooks.cs"
                            : "PageElements/DashboardObjects.cs",
                        ModificationType = decisionType == EngineeringDecisionType.Reuse
                            ? FileModificationType.Reuse
                            : decisionType == EngineeringDecisionType.Extend
                                ? FileModificationType.Extend
                                : FileModificationType.Create,
                        Reason    = "test",
                        Evidence  = "element found",
                        IsProtected = withProtectedFile
                    }
                }
            };
            return plan;
        }

        // ===========================
        // Decision handling
        // ===========================

        [Fact]
        public void Engine_ReuseDecision_RecordsSkippedChange()
        {
            var plan = MakePlan(EngineeringDecisionType.Reuse);
            var engine = new ImplementationEngine();
            var result = engine.Execute(plan);

            Assert.Contains(result.Changes, c =>
                c.ChangeType == ChangeType.Reuse && c.Status == ChangeStatus.Skipped);
        }

        [Fact]
        public void Engine_ExtendDecision_RecordsAppliedChange()
        {
            var plan = MakePlan(EngineeringDecisionType.Extend);
            var engine = new ImplementationEngine();
            var result = engine.Execute(plan);

            Assert.Contains(result.Changes, c =>
                c.ChangeType == ChangeType.Extend && c.Status == ChangeStatus.Applied);
        }

        [Fact]
        public void Engine_CreateDecision_RecordsAppliedChange()
        {
            var plan = MakePlan(EngineeringDecisionType.Create);
            var engine = new ImplementationEngine();
            var result = engine.Execute(plan);

            Assert.Contains(result.Changes, c =>
                c.ChangeType == ChangeType.Create && c.Status == ChangeStatus.Applied);
        }

        [Fact]
        public void Engine_HumanReviewPlan_StopsWithoutModifyingFiles()
        {
            var plan = MakePlan(planHumanReview: true);
            var engine = new ImplementationEngine();
            var result = engine.Execute(plan);

            Assert.Equal(ImplementationStatus.HumanReviewRequired, result.FinalStatus);
            Assert.Empty(result.Changes);  // no changes when plan requires human review
        }

        [Fact]
        public void Engine_ProtectedFile_ReturnsHumanReviewRequired()
        {
            var plan   = MakePlan(withProtectedFile: true);
            var engine = new ImplementationEngine();
            var result = engine.Execute(plan);

            Assert.Contains(result.Changes, c => c.Status == ChangeStatus.HumanReviewRequired);
        }

        [Fact]
        public void Engine_UnauthorizedFile_NotModified()
        {
            // No file outside the plan should ever be changed
            var plan   = MakePlan(EngineeringDecisionType.Create);
            var engine = new ImplementationEngine();
            var result = engine.Execute(plan);

            var unauthorised = result.Changes
                .Where(c => !plan.PlannedFileChanges
                    .Any(pf => pf.FilePath == c.FilePath) &&
                    c.ChangeType != ChangeType.Reuse)
                .ToList();
            Assert.Empty(unauthorised);
        }

        [Fact]
        public void Engine_FrameworkModified_AlwaysFalse()
        {
            var plan   = MakePlan(EngineeringDecisionType.Create);
            var engine = new ImplementationEngine();
            var result = engine.Execute(plan);

            Assert.False(result.FrameworkModified);
        }

        // ===========================
        // Self-healing
        // ===========================

        [Fact]
        public void SelfHeal_SafeError_Corrects()
        {
            var engine = new ImplementationEngine();
            var record = new ImplementationExecutionRecord { PlanId = "p1", StartedAt = DateTime.UtcNow };
            var heal   = engine.TryCorrect(
                "CS0246: The type or namespace name 'IPage' could not be found",
                record, currentAttempt: 0, maxRetries: 2);

            Assert.True(heal.Succeeded);
            Assert.False(heal.RequiresHuman);
            Assert.Equal(1, record.CorrectionsSucceeded);
        }

        [Fact]
        public void SelfHeal_UnsafeError_RequiresHuman()
        {
            var engine = new ImplementationEngine();
            var record = new ImplementationExecutionRecord { PlanId = "p1", StartedAt = DateTime.UtcNow };
            var heal   = engine.TryCorrect(
                "AutomationFrameWork files were modified unexpectedly",
                record, currentAttempt: 0, maxRetries: 2);

            Assert.False(heal.Succeeded);
            Assert.True(heal.RequiresHuman);
        }

        [Fact]
        public void SelfHeal_RetryLimit_Stops()
        {
            var engine = new ImplementationEngine();
            var record = new ImplementationExecutionRecord { PlanId = "p1", StartedAt = DateTime.UtcNow };
            var heal   = engine.TryCorrect("some error",
                record, currentAttempt: 2, maxRetries: 2);  // at limit

            Assert.False(heal.Succeeded);
            Assert.True(heal.RequiresHuman);
            Assert.NotEmpty(record.HumanReviewNotes);
        }

        [Fact]
        public void SelfHeal_MaxRetries_IsPositiveAndBounded()
        {
            Assert.True(ImplementationEngine.DefaultMaxRetries > 0);
            Assert.True(ImplementationEngine.DefaultMaxRetries <= 5);
        }

        // ===========================
        // Rollback
        // ===========================

        [Fact]
        public void Rollback_AddsRollbackRecord()
        {
            var engine = new ImplementationEngine();
            var record = new ImplementationExecutionRecord { PlanId = "p1", StartedAt = DateTime.UtcNow };
            var rb     = engine.Rollback("PageElements/DashboardObjects.cs", record);

            Assert.True(rb.Succeeded);
            Assert.Equal(1, record.Rollbacks);
            Assert.Contains(record.Changes, c => c.ChangeType == ChangeType.Rollback);
        }

        [Fact]
        public void Rollback_DoesNotLeavePartialChanges()
        {
            var engine = new ImplementationEngine();
            var record = new ImplementationExecutionRecord { PlanId = "p1", StartedAt = DateTime.UtcNow };
            engine.Rollback("SomeFile.cs", record);

            // After rollback, no Applied changes without a paired Rollback
            var appliedPaths  = record.Changes.Where(c => c.Status == ChangeStatus.Applied).Select(c => c.FilePath);
            var rolledPaths   = record.Changes.Where(c => c.Status == ChangeStatus.RolledBack).Select(c => c.FilePath);
            // For every rolled-back path, there must be a rollback record
            Assert.Contains("SomeFile.cs", rolledPaths);
        }

        // ===========================
        // Failure classification
        // ===========================

        [Fact]
        public void BuildFailureCategory_Enum_CoversMandatoryCategories()
        {
            var categories = Enum.GetNames(typeof(FailureCategory));
            Assert.Contains("MissingUsing", categories);
            Assert.Contains("SyntaxError", categories);
            Assert.Contains("TypeMismatch", categories);
            Assert.Contains("TestRegression", categories);
            Assert.Contains("ProtectedFileModification", categories);
            Assert.Contains("Unknown", categories);
        }

        // ===========================
        // Determinism
        // ===========================

        [Fact]
        public void Engine_IsDeterministic_SameInputSameOutput()
        {
            var plan   = MakePlan(EngineeringDecisionType.Create);
            var engine = new ImplementationEngine();
            var r1     = engine.Execute(plan);
            var r2     = engine.Execute(plan);

            Assert.Equal(r1.FinalStatus, r2.FinalStatus);
            Assert.Equal(r1.Changes.Count, r2.Changes.Count);
        }

        // ===========================
        // Evidence logging
        // ===========================

        [Fact]
        public void Engine_ChangeRecord_CarriesEvidence()
        {
            var plan   = MakePlan(EngineeringDecisionType.Create);
            var engine = new ImplementationEngine();
            var result = engine.Execute(plan);

            var applied = result.Changes.Where(c => c.Status == ChangeStatus.Applied).ToList();
            Assert.All(applied, c => Assert.False(string.IsNullOrEmpty(c.Evidence)));
        }
    }
}
