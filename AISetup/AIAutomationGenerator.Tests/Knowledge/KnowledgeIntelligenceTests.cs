using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using AIAutomationGenerator.Knowledge;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Tests.Knowledge
{
    /// <summary>
    /// V6.0 P2 tests — Evidence model, enrichment, traceability, conflict detection,
    /// NO_REPOSITORY_EVIDENCE, missing knowledge, metrics, framework protection.
    /// </summary>
    public class KnowledgeIntelligenceTests
    {
        // ===========================
        // Helpers
        // ===========================

        private static AutomationIntelligenceModel BuildModel(
            string page = "Dashboard",
            string recommendation = "REUSE")
        {
            var model = new AutomationIntelligenceModel
            {
                AnalysisTimestamp   = DateTime.UtcNow.ToString("O"),
                RepositoryRoot      = "TestRepo",
                RepositoryKnowledge = new RepositoryKnowledgeModel
                {
                    PageElements = new List<PageElementInfo>
                    {
                        new() { Name = "SearchButton", ClassName = "DashboardObjects",
                                FilePath = "PageElements/DashboardObjects.cs",
                                PageOwnership = page, Selector = "#btnSearch",
                                LocatorType = "id", ConfidenceScore = 0.9 }
                    },
                    PageActions = new List<PageActionInfo>
                    {
                        new() { Name = "SearchForPackages", ClassName = "DashboardMethods",
                                FilePath = "PageActions/DashboardMethods.cs",
                                PageOwnership = page, ConfidenceScore = 0.9 }
                    },
                    StepDefinitions = new List<StepDefinitionInfo>()
                },
                RecordingIntelligence = new RecordingIntelligenceModel
                {
                    Actions = new List<RecordedActionIntelligence>
                    {
                        new() { Sequence = 0, ActionType = "click",
                                InferredPageContext = page, LocatorValue = "#btnSearch" }
                    }
                },
                Decisions = new List<IntelligenceDecision>
                {
                    new() { ActionIndex = 0, ActionDescription = "click Search",
                            DecisionType = "PageElement", Recommendation = recommendation,
                            TargetComponent = "DashboardObjects.SearchButton",
                            ConfidenceScore = 0.9 }
                }
            };
            return model;
        }

        private static KnowledgeRetrievalResult BuildRetrieval(
            string page = "Dashboard",
            string componentName = "SearchButton",
            string sourcePath = "PageElements/DashboardObjects.cs")
        {
            var item = new KnowledgeItem
            {
                SourceType    = KnowledgeSourceType.PageElement,
                SourcePath    = sourcePath,
                PageOwnership = page,
                ComponentName = componentName,
                Description   = "Search button locator",
                LocatorValue  = "#btnSearch",
                Confidence    = 0.9,
                IsInferred    = false,
                RelevantPages = new[] { page }
            };
            return new KnowledgeRetrievalResult
            {
                Items = new List<KnowledgeItem> { item },
                Metrics = new KnowledgeRetrievalMetrics
                {
                    TotalIndexedItems = 1,
                    RetrievedItems    = 1,
                    TokenMeasurement  = "NOT_AVAILABLE"
                }
            };
        }

        // ===========================
        // KnowledgeEvidence model
        // ===========================

        [Fact]
        public void Evidence_Model_CanBeConstructed()
        {
            var ev = new KnowledgeEvidence
            {
                KnowledgeId   = "abc",
                SourceType    = KnowledgeSourceType.PageElement,
                SourcePath    = "PageElements/Foo.cs",
                RetrievalReason = "page-match",
                EvidenceText  = "Found matching element",
                IsDirect      = true,
                Confidence    = ConfidenceLevel.High,
                Relevance     = 0.9
            };
            Assert.Equal("page-match", ev.RetrievalReason);
            Assert.True(ev.IsDirect);
        }

        [Fact]
        public void Evidence_Default_TokenMeasurementIsNotAvailable()
        {
            var metrics = new KnowledgeIntelligenceMetrics();
            Assert.Equal("NOT_AVAILABLE", metrics.TokenMeasurement);
        }

        // ===========================
        // KnowledgeEnrichmentService
        // ===========================

        [Fact]
        public void Enrichment_WithRetrieval_SetsRetrievedKnowledgeOnModel()
        {
            var model    = BuildModel();
            var svc      = new KnowledgeEnrichmentService();
            var retrieval = BuildRetrieval();

            svc.Enrich(model, retrieval);

            Assert.NotNull(model.RetrievedKnowledge);
            Assert.True(model.HasKnowledgeEnrichment);
        }

        [Fact]
        public void Enrichment_DecisionWithMatchingEvidence_HasEvidenceAttached()
        {
            var model    = BuildModel();
            var svc      = new KnowledgeEnrichmentService();
            svc.Enrich(model, BuildRetrieval());

            Assert.NotEmpty(model.DecisionEvidence);
        }

        [Fact]
        public void Enrichment_NoMatchingEvidence_ReportsNoRepositoryEvidence()
        {
            var model    = BuildModel("Dashboard");
            // Retrieval from a different page — no matches
            var retrieval = BuildRetrieval("Login", "LoginButton", "PageElements/LoginObjects.cs");
            var svc      = new KnowledgeEnrichmentService();
            svc.Enrich(model, retrieval);

            var allEvidence = model.DecisionEvidence.SelectMany(kvp => kvp.Value).ToList();
            Assert.Contains(allEvidence, e => e.RetrievalReason == "NO_REPOSITORY_EVIDENCE");
        }

        [Fact]
        public void Enrichment_NoRepositoryEvidence_NeverFabricatesItem()
        {
            var model     = BuildModel("Dashboard");
            var retrieval = BuildRetrieval("Login", "LoginButton", "PageElements/LoginObjects.cs");
            var svc       = new KnowledgeEnrichmentService();
            svc.Enrich(model, retrieval);

            var allEvidence = model.DecisionEvidence.SelectMany(kvp => kvp.Value).ToList();

            // When no evidence: KnowledgeId must be "none" or similar — not a fake real ID
            var noEvidence = allEvidence.Where(e => e.RetrievalReason == "NO_REPOSITORY_EVIDENCE");
            Assert.All(noEvidence, e => Assert.Equal("none", e.KnowledgeId));
        }

        [Fact]
        public void Enrichment_NullRetrieval_SetsMetricsOnly()
        {
            var model = BuildModel();
            var svc   = new KnowledgeEnrichmentService();
            svc.Enrich(model, null);

            Assert.NotNull(model.KnowledgeMetrics);
            Assert.Equal("NOT_AVAILABLE", model.KnowledgeMetrics.TokenMeasurement);
        }

        [Fact]
        public void Enrichment_Metrics_TokenMeasurementIsNotAvailable()
        {
            var model = BuildModel();
            var svc   = new KnowledgeEnrichmentService();
            svc.Enrich(model, BuildRetrieval());

            Assert.Equal("NOT_AVAILABLE", model.KnowledgeMetrics.TokenMeasurement);
        }

        [Fact]
        public void Enrichment_Metrics_CountsAreConsistent()
        {
            var model = BuildModel();
            var svc   = new KnowledgeEnrichmentService();
            svc.Enrich(model, BuildRetrieval());

            var m = model.KnowledgeMetrics;
            Assert.True(m.UsedKnowledgeCount + m.UnusedKnowledgeCount == m.RetrievedKnowledgeCount);
        }

        [Fact]
        public void Enrichment_EvidenceCount_MatchesModelProperty()
        {
            var model = BuildModel();
            var svc   = new KnowledgeEnrichmentService();
            svc.Enrich(model, BuildRetrieval());

            Assert.Equal(model.EvidenceCount, model.KnowledgeMetrics.EvidenceCount);
        }

        [Fact]
        public void Enrichment_SourceTraceability_EachEvidenceHasSourceType()
        {
            var model = BuildModel();
            var svc   = new KnowledgeEnrichmentService();
            svc.Enrich(model, BuildRetrieval());

            var realEvidence = model.DecisionEvidence
                .SelectMany(kvp => kvp.Value)
                .Where(e => e.RetrievalReason != "NO_REPOSITORY_EVIDENCE");

            Assert.All(realEvidence, e => Assert.False(string.IsNullOrEmpty(e.SourcePath)));
        }

        [Fact]
        public void Enrichment_DirectVsInferred_EvidenceCarriesFlag()
        {
            var model = BuildModel();
            var svc   = new KnowledgeEnrichmentService();
            svc.Enrich(model, BuildRetrieval());

            var realEvidence = model.DecisionEvidence
                .SelectMany(kvp => kvp.Value)
                .Where(e => e.KnowledgeId != "none")
                .ToList();

            // PageElement is directly sourced → IsDirect = true
            Assert.All(realEvidence, e => Assert.True(e.IsDirect));
        }

        // ===========================
        // Conflict detection
        // ===========================

        [Fact]
        public void Enrichment_ConflictingItems_DetectedAndRecorded()
        {
            // Two items with same ComponentName but different SourcePaths
            var conflict1 = new KnowledgeItem
            {
                SourceType = KnowledgeSourceType.PageElement, ComponentName = "SearchButton",
                SourcePath = "PageElements/DashboardObjects.cs",
                PageOwnership = "Dashboard", RelevantPages = new[] { "Dashboard" }
            };
            var conflict2 = new KnowledgeItem
            {
                SourceType = KnowledgeSourceType.PageElement, ComponentName = "SearchButton",
                SourcePath = "PageElements/DashboardObjects_Old.cs",
                PageOwnership = "Dashboard", RelevantPages = new[] { "Dashboard" }
            };

            var retrieval = new KnowledgeRetrievalResult
            {
                Items   = new List<KnowledgeItem> { conflict1, conflict2 },
                Metrics = new KnowledgeRetrievalMetrics { TokenMeasurement = "NOT_AVAILABLE" }
            };

            var model = BuildModel();
            var svc   = new KnowledgeEnrichmentService();
            svc.Enrich(model, retrieval);

            Assert.NotEmpty(model.KnowledgeConflicts);
            Assert.Equal("HUMAN_REVIEW_REQUIRED", model.KnowledgeConflicts[0].Resolution);
        }

        [Fact]
        public void Enrichment_NoConflict_ConflictListIsEmpty()
        {
            var model = BuildModel();
            var svc   = new KnowledgeEnrichmentService();
            svc.Enrich(model, BuildRetrieval()); // single item, no conflict

            Assert.Empty(model.KnowledgeConflicts);
            Assert.Equal(0, model.KnowledgeMetrics.KnowledgeConflicts);
        }

        // ===========================
        // AutomationIntelligenceModel V6.0 fields
        // ===========================

        [Fact]
        public void Model_V60Fields_ExistAndDefaultCorrectly()
        {
            var model = new AutomationIntelligenceModel();

            Assert.Null(model.RetrievedKnowledge);
            Assert.NotNull(model.DecisionEvidence);
            Assert.NotNull(model.KnowledgeConflicts);
            Assert.Null(model.KnowledgeMetrics);
            Assert.False(model.HasKnowledgeEnrichment);
            Assert.Equal(0, model.EvidenceCount);
        }

        [Fact]
        public void Model_V50FieldsUnchanged_IsValidStillWorks()
        {
            // Verify backward compatibility — IsValid ignores V6.0 fields
            var model = new AutomationIntelligenceModel
            {
                RepositoryKnowledge   = new RepositoryKnowledgeModel { PageElements = new() },
                RecordingIntelligence = new RecordingIntelligenceModel()
            };
            Assert.True(model.IsValid);
        }

        // ===========================
        // Framework protection
        // ===========================

        [Fact]
        public void Enrichment_DoesNotModifyRetrievalInput()
        {
            // Enrich is read-only relative to KnowledgeRetrievalResult
            var retrieval = BuildRetrieval();
            int countBefore = retrieval.Items.Count;

            var model = BuildModel();
            new KnowledgeEnrichmentService().Enrich(model, retrieval);

            Assert.Equal(countBefore, retrieval.Items.Count);
        }

        [Fact]
        public void Enrichment_WithoutDecisions_AttachesEvidencePerRecordedAction()
        {
            var model = BuildModel();
            model.Decisions.Clear();

            new KnowledgeEnrichmentService().Enrich(model, BuildRetrieval());

            Assert.True(model.DecisionEvidence.TryGetValue(0, out var evidence));
            Assert.NotNull(evidence);
            Assert.Contains(evidence, item => item.KnowledgeId != "none");
            Assert.True(model.EvidenceCount > 0);
        }
    }
}
