using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using AIAutomationGenerator.Intelligence.Services;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Tests.Intelligence
{
    /// <summary>
    /// Tests for V5.0 Prompt 1 — RelevantContextSelector.
    ///
    /// Validates:
    ///   1. Page signal derivation from all available signals
    ///   2. Component filtering (only relevant pages pass through)
    ///   3. Measurable reduction metrics (exact counts, no estimates)
    ///   4. Correctness: relevant components are NOT dropped
    ///   5. Correctness: irrelevant components ARE excluded
    ///   6. Token measurement is explicitly NOT_AVAILABLE (no fabricated numbers)
    /// </summary>
    public class RelevantContextSelectorTests
    {
        private readonly RelevantContextSelector _selector = new();

        // ===== Helpers =====

        private static RepositoryKnowledgeModel BuildRepository(int pages = 5)
        {
            var elements   = new List<PageElementInfo>();
            var actions    = new List<PageActionInfo>();
            var steps      = new List<StepDefinitionInfo>();
            var features   = new List<FeatureFileInfo>();
            var relations  = new List<PageComponentRelationship>();

            for (int i = 1; i <= pages; i++)
            {
                var page = $"Page{i}";
                elements.Add(new PageElementInfo   { Name = $"{page}Objects",  ClassName = $"{page}Objects",  PageOwnership = page, FilePath = $"PageElements/{page}Objects.cs",  ConfidenceScore = 0.9 });
                actions.Add(new PageActionInfo    { Name = $"{page}Methods",  ClassName = $"{page}Methods",  PageOwnership = page, FilePath = $"PageActions/{page}Methods.cs",   ConfidenceScore = 0.9 });
                steps.Add(new StepDefinitionInfo  { StepText = $"{page}Steps", FilePath = $"StepDefinitions/{page}Steps.cs", PageOwnership = page, ConfidenceScore = 0.9 });
                features.Add(new FeatureFileInfo  { FeatureName = $"{page}Feature", FilePath = $"Features/{page}.feature", RelatedPages = new List<string> { page } });
                relations.Add(new PageComponentRelationship { PageName = page, PageElementFiles = new List<string> { $"{page}Objects.cs" } });
            }

            return new RepositoryKnowledgeModel
            {
                RepositoryRoot  = "TestRepo",
                LastScanTime    = DateTime.UtcNow.ToString("O"),
                PageElements    = elements,
                PageActions     = actions,
                StepDefinitions = steps,
                Features        = features,
                PageRelationships = relations
            };
        }

        private static RecordedActionIntelligence Navigate(string url, string page) =>
            new() { Sequence = 0, ActionType = "navigate", LocatorType = "url", LocatorValue = url, InferredPageContext = page };

        private static RecordedActionIntelligence Click(string name, string page) =>
            new() { Sequence = 1, ActionType = "click", LocatorType = "role", GetByRoleName = name, Target = name, InferredPageContext = page };

        private static RecordedActionIntelligence LinkClick(string linkName, string page) =>
            new() { Sequence = 2, ActionType = "click", LocatorType = "role", GetByRoleName = linkName, Target = linkName, InferredPageContext = page };

        private static RecordedActionIntelligence IdSelect(string id, string page) =>
            new() { Sequence = 3, ActionType = "selectOption", LocatorType = "id", LocatorValue = id, InferredPageContext = page };

        // ===== Page signal derivation tests =====

        [Fact]
        public void DerivePageSignals_FromInferredPageContext_ReturnsPage()
        {
            var actions = new List<RecordedActionIntelligence>
            {
                new() { Sequence = 0, ActionType = "click", InferredPageContext = "Dashboard" }
            };

            var pages = _selector.DerivePageSignals(actions);

            Assert.Contains("Dashboard", pages);
        }

        [Fact]
        public void DerivePageSignals_FromNavigateUrl_ExtractsPathSegment()
        {
            var actions = new List<RecordedActionIntelligence>
            {
                Navigate("https://app.example.com/ReassignPackages.aspx", null)
            };

            var pages = _selector.DerivePageSignals(actions);

            Assert.Contains("ReassignPackages", pages);
        }

        [Fact]
        public void DerivePageSignals_FromLinkClick_ExtractsPascalCaseName()
        {
            var actions = new List<RecordedActionIntelligence>
            {
                new() { Sequence = 0, ActionType = "click", LocatorType = "role",
                        GetByRoleName = "View Deal", InferredPageContext = null }
            };

            var pages = _selector.DerivePageSignals(actions);

            Assert.Contains("ViewDeal", pages);
        }

        [Fact]
        public void DerivePageSignals_FromMultipleSources_DeduplicatesCorrectly()
        {
            var actions = new List<RecordedActionIntelligence>
            {
                Navigate("https://app.com/Dashboard.aspx", "Dashboard"),
                Click("Submit", "Dashboard"),
                LinkClick("Dashboard", "Home")
            };

            var pages = _selector.DerivePageSignals(actions);

            // "Dashboard" should appear exactly once despite multiple signals
            Assert.Single(pages.Where(p => p == "Dashboard"));
        }

        [Fact]
        public void DerivePageSignals_FiltersOutNoiseWords()
        {
            var actions = new List<RecordedActionIntelligence>
            {
                Navigate("https://app.com/Default.aspx", "Default"),
                Navigate("https://app.com/", "Home")
            };

            var pages = _selector.DerivePageSignals(actions);

            // "Default" and "Home" are in the noise list — both should be excluded
            Assert.DoesNotContain("Default", pages);
            Assert.DoesNotContain("Home", pages);
        }

        [Fact]
        public void DerivePageSignals_EmptyActions_ReturnsEmpty()
        {
            var pages = _selector.DerivePageSignals(new List<RecordedActionIntelligence>());
            Assert.Empty(pages);
        }

        // ===== Component filtering tests =====

        [Fact]
        public void SelectRelevantContext_OnlyTouchedPages_AreIncluded()
        {
            // Repository has Page1..Page5; recording only touches Page2 and Page4
            var repo = BuildRepository(5);
            var actions = new List<RecordedActionIntelligence>
            {
                new() { Sequence = 0, ActionType = "click", InferredPageContext = "Page2" },
                new() { Sequence = 1, ActionType = "click", InferredPageContext = "Page4" }
            };

            var result = _selector.SelectRelevantContext(repo, actions);

            Assert.All(result.FilteredIndex.PageElements, e =>
                Assert.True(e.PageOwnership == "Page2" || e.PageOwnership == "Page4" || string.IsNullOrEmpty(e.PageOwnership)));
            Assert.All(result.FilteredIndex.PageActions, a =>
                Assert.True(a.PageOwnership == "Page2" || a.PageOwnership == "Page4" || string.IsNullOrEmpty(a.PageOwnership)));
        }

        [Fact]
        public void SelectRelevantContext_UntouchedPages_AreExcluded()
        {
            var repo = BuildRepository(5);
            var actions = new List<RecordedActionIntelligence>
            {
                new() { Sequence = 0, ActionType = "click", InferredPageContext = "Page1" }
            };

            var result = _selector.SelectRelevantContext(repo, actions);

            // Page3, Page4, Page5 should not appear
            Assert.DoesNotContain(result.FilteredIndex.PageElements, e => e.PageOwnership == "Page3");
            Assert.DoesNotContain(result.FilteredIndex.PageElements, e => e.PageOwnership == "Page4");
            Assert.DoesNotContain(result.FilteredIndex.PageElements, e => e.PageOwnership == "Page5");
        }

        [Fact]
        public void SelectRelevantContext_RelevantComponentsAreNotDropped()
        {
            var repo = BuildRepository(3);
            var actions = new List<RecordedActionIntelligence>
            {
                new() { Sequence = 0, ActionType = "click", InferredPageContext = "Page2" }
            };

            var result = _selector.SelectRelevantContext(repo, actions);

            // Page2 components must be present
            Assert.Contains(result.FilteredIndex.PageElements, e => e.PageOwnership == "Page2");
            Assert.Contains(result.FilteredIndex.PageActions,  a => a.PageOwnership == "Page2");
            Assert.Contains(result.FilteredIndex.StepDefinitions, s => s.PageOwnership == "Page2");
        }

        // ===== Metrics tests =====

        [Fact]
        public void SelectRelevantContext_Metrics_TotalCountsMatchFullRepository()
        {
            var repo = BuildRepository(5);
            var actions = new List<RecordedActionIntelligence>
            {
                new() { Sequence = 0, ActionType = "click", InferredPageContext = "Page1" }
            };

            var result = _selector.SelectRelevantContext(repo, actions);
            var m = result.Metrics;

            Assert.Equal(5, m.TotalPageElements);
            Assert.Equal(5, m.TotalPageActions);
            Assert.Equal(5, m.TotalStepDefinitions);
            Assert.Equal(5, m.TotalFeatures);
            Assert.Equal(20, m.TotalComponentsConsidered); // 5*4
        }

        [Fact]
        public void SelectRelevantContext_Metrics_SelectedCountsMatchFilteredRepository()
        {
            var repo = BuildRepository(5);
            var actions = new List<RecordedActionIntelligence>
            {
                new() { Sequence = 0, ActionType = "click", InferredPageContext = "Page1" }
            };

            var result = _selector.SelectRelevantContext(repo, actions);
            var m = result.Metrics;

            // 1 of 5 pages selected → 4 components (Element, Action, Step, Feature)
            Assert.Equal(1, m.SelectedPageElements);
            Assert.Equal(1, m.SelectedPageActions);
            Assert.Equal(1, m.SelectedStepDefinitions);
            Assert.Equal(1, m.SelectedFeatures);
            Assert.Equal(4, m.SelectedComponentsTotal);
        }

        [Fact]
        public void SelectRelevantContext_Metrics_ReductionPercentIsAccurate()
        {
            var repo = BuildRepository(5);
            // 1 page out of 5 → 16 components excluded out of 20 total → 80% reduction
            var actions = new List<RecordedActionIntelligence>
            {
                new() { Sequence = 0, ActionType = "click", InferredPageContext = "Page1" }
            };

            var result = _selector.SelectRelevantContext(repo, actions);

            Assert.Equal(80.0, result.Metrics.ReductionPercent);
        }

        [Fact]
        public void SelectRelevantContext_Metrics_DurationIsRecorded()
        {
            var repo = BuildRepository(3);
            var actions = new List<RecordedActionIntelligence>
            {
                new() { Sequence = 0, ActionType = "click", InferredPageContext = "Page1" }
            };

            var result = _selector.SelectRelevantContext(repo, actions);

            Assert.True(result.Metrics.SelectionDurationMs >= 0);
        }

        [Fact]
        public void SelectRelevantContext_Metrics_TokenMeasurementIsNotAvailable()
        {
            // This test enforces that we never claim token savings without measurement.
            var repo = BuildRepository(3);
            var actions = new List<RecordedActionIntelligence>
            {
                new() { Sequence = 0, ActionType = "click", InferredPageContext = "Page1" }
            };

            var result = _selector.SelectRelevantContext(repo, actions);

            Assert.Contains("NOT_AVAILABLE", result.Metrics.TokenMeasurement);
        }

        [Fact]
        public void SelectRelevantContext_Metrics_InferredPagesAreRecorded()
        {
            var repo = BuildRepository(5);
            var actions = new List<RecordedActionIntelligence>
            {
                new() { Sequence = 0, ActionType = "click", InferredPageContext = "Page2" },
                new() { Sequence = 1, ActionType = "click", InferredPageContext = "Page4" }
            };

            var result = _selector.SelectRelevantContext(repo, actions);

            Assert.Equal(2, result.Metrics.InferredPageCount);
            Assert.Contains("Page2", result.Metrics.InferredPages);
            Assert.Contains("Page4", result.Metrics.InferredPages);
        }

        // ===== Edge cases =====

        [Fact]
        public void SelectRelevantContext_NullActions_ReturnsFullIndex()
        {
            var repo    = BuildRepository(3);
            var result  = _selector.SelectRelevantContext(repo, null);

            // When no actions, return full index (no reduction)
            Assert.Equal(3, result.FilteredIndex.PageElements.Count);
        }

        [Fact]
        public void SelectRelevantContext_EmptyActions_ReturnsFullIndex()
        {
            var repo    = BuildRepository(3);
            var result  = _selector.SelectRelevantContext(repo, new List<RecordedActionIntelligence>());

            Assert.Equal(3, result.FilteredIndex.PageElements.Count);
        }

        [Fact]
        public void SelectRelevantContext_AllPagesInRecording_ReturnsFullIndex()
        {
            var repo = BuildRepository(3);
            var actions = new List<RecordedActionIntelligence>
            {
                new() { Sequence = 0, InferredPageContext = "Page1" },
                new() { Sequence = 1, InferredPageContext = "Page2" },
                new() { Sequence = 2, InferredPageContext = "Page3" }
            };

            var result = _selector.SelectRelevantContext(repo, actions);

            // All 3 pages touched → all components included → 0% reduction
            Assert.Equal(3, result.FilteredIndex.PageElements.Count);
            Assert.Equal(0.0, result.Metrics.ReductionPercent);
        }

        // ===== Integration: wired into AutomationIntelligenceModel =====

        [Fact]
        public void AutomationIntelligenceModel_V50_ContextSelectionFieldExists()
        {
            // V5.0 P1 added ContextSelection to AutomationIntelligenceModel.
            // This test verifies the field is accessible.
            var model = new AIAutomationGenerator.Intelligence.Models.AutomationIntelligenceModel
            {
                ContextSelection = new ContextSelectionMetrics
                {
                    TotalComponentsConsidered = 20,
                    SelectedComponentsTotal   = 4,
                    ReductionPercent          = 80.0,
                    TokenMeasurement          = "NOT_AVAILABLE"
                }
            };

            Assert.NotNull(model.ContextSelection);
            Assert.Equal(80.0, model.ContextSelection.ReductionPercent);
            Assert.Contains("NOT_AVAILABLE", model.ContextSelection.TokenMeasurement);
        }
    }
}
