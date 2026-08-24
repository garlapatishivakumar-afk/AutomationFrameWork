using System;
using System.Collections.Generic;
using System.Linq;
using Xunit;
using AIAutomationGenerator.Knowledge;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Tests.Knowledge
{
    /// <summary>
    /// V6.0 P1 tests — Knowledge model, index, retrieval, source traceability,
    /// determinism, no-fabrication, and metrics.
    /// </summary>
    public class KnowledgeFoundationTests
    {
        // ===========================
        // Helpers
        // ===========================

        private static RepositoryKnowledgeModel BuildRepo(string page = "Dashboard") =>
            new()
            {
                RepositoryRoot  = "TestRepo",
                LastScanTime    = DateTime.UtcNow.ToString("O"),
                PageElements    = new List<PageElementInfo>
                {
                    new() { Name = "SearchButton", ClassName = "DashboardObjects",
                            FilePath = "PageElements/DashboardObjects.cs",
                            PageOwnership = page, Selector = "#btnSearch",
                            LocatorType = "id", ConfidenceScore = 0.9 },
                    new() { Name = "UserDropdown", ClassName = "DashboardObjects",
                            FilePath = "PageElements/DashboardObjects.cs",
                            PageOwnership = page, Selector = "#ddlUser",
                            LocatorType = "id", ConfidenceScore = 0.9 }
                },
                PageActions     = new List<PageActionInfo>
                {
                    new() { Name = "SearchForPackages", ClassName = "DashboardMethods",
                            FilePath = "PageActions/DashboardMethods.cs",
                            PageOwnership = page, IsAsync = true, ConfidenceScore = 0.9 }
                },
                StepDefinitions = new List<StepDefinitionInfo>
                {
                    new() { StepText = "the user searches for packages",
                            FilePath = "StepDefinitions/DashboardSteps.cs",
                            PageOwnership = page, ConfidenceScore = 0.9 }
                },
                Features = new List<FeatureFileInfo>
                {
                    new() { FeatureName = "ViewDashboard",
                            FilePath = "Features/ViewDashboard.feature",
                            RelatedPages = new List<string> { page } }
                },
                PageRelationships = new List<PageComponentRelationship>
                {
                    new() { PageName = page,
                            PageElementFiles = new() { "DashboardObjects.cs" },
                            PageActionFiles  = new() { "DashboardMethods.cs" } }
                }
            };

        private static RecordedActionIntelligence Action(string type, string page, string locator = null) =>
            new() { Sequence = 0, ActionType = type, InferredPageContext = page, LocatorValue = locator };

        private static RepositoryKnowledgeModel BuildDocumentAdminRepo() =>
            new()
            {
                RepositoryRoot = "TestRepo",
                LastScanTime = DateTime.UtcNow.ToString("O"),
                PageElements = new List<PageElementInfo>
                {
                    new() { Name = "AdministrationLink", ClassName = "ViewDashboardObjects", FilePath = "PageElements/ViewDashboardObjects.cs", PageOwnership = "ViewDashboard", Selector = "page.GetByRole(AriaRole.Link, new() { Name = \"Administration\" })", LocatorType = "role", ConfidenceScore = 0.95 },
                    new() { Name = "ReassignPackagesLink", ClassName = "ViewDashboardObjects", FilePath = "PageElements/ViewDashboardObjects.cs", PageOwnership = "ViewDashboard", Selector = "page.GetByRole(AriaRole.Link, new() { Name = \"Reassign Packages\" })", LocatorType = "role", ConfidenceScore = 0.95 },
                    new() { Name = "SearchUserDropdown", ClassName = "ViewDashboardObjects", FilePath = "PageElements/ViewDashboardObjects.cs", PageOwnership = "ViewDashboard", Selector = "page.Locator(\"#ctl00_ContentPlaceHolder1_ddlSearchUser\")", LocatorType = "id", ConfidenceScore = 0.95 }
                },
                PageActions = new List<PageActionInfo>
                {
                    new() { Name = "NavigateToDocumentAdministrationAsync", ClassName = "ViewDashboardMethods", FilePath = "PageActions/ViewDashboardMethods.cs", PageOwnership = "ViewDashboard", IsAsync = true, ConfidenceScore = 0.9 },
                    new() { Name = "ClickAdministrationLinkAsync", ClassName = "ViewDashboardMethods", FilePath = "PageActions/ViewDashboardMethods.cs", PageOwnership = "ViewDashboard", IsAsync = true, ConfidenceScore = 0.9 }
                },
                StepDefinitions = new List<StepDefinitionInfo>
                {
                    new() { StepText = "user navigates to document administration page", MethodName = "GivenUserNavigatesToDocumentAdministrationPage", ClassName = "ViewDashboardSteps", FilePath = "StepDefinitions/ViewDashboardSteps.cs", PageOwnership = "ViewDashboard", ConfidenceScore = 0.9 },
                    new() { StepText = "user clicks on Administration link", MethodName = "WhenUserClicksOnAdministrationLink", ClassName = "ViewDashboardSteps", FilePath = "StepDefinitions/ViewDashboardSteps.cs", PageOwnership = "ViewDashboard", ConfidenceScore = 0.9 }
                },
                Features = new List<FeatureFileInfo>
                {
                    new() { FeatureName = "ViewDashboard", FilePath = "Features/ViewDashboard.feature", RelatedPages = new List<string> { "ViewDashboard" } }
                },
                PageRelationships = new List<PageComponentRelationship>
                {
                    new() { PageName = "ViewDashboard", PageElementFiles = new() { "PageElements/ViewDashboardObjects.cs" }, PageActionFiles = new() { "PageActions/ViewDashboardMethods.cs" }, StepDefinitionFiles = new() { "StepDefinitions/ViewDashboardSteps.cs" }, FeatureFiles = new() { "Features/ViewDashboard.feature" } }
                }
            };

        // ===========================
        // KnowledgeIndexService
        // ===========================

        [Fact]
        public void Index_BuildFromRepo_ProducesItems()
        {
            var svc   = new KnowledgeIndexService();
            var index = svc.Build(BuildRepo("Dashboard"));

            Assert.False(index.IsEmpty);
            Assert.True(index.TotalItems > 0);
        }

        [Fact]
        public void Index_Build_ContainsPageElements()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            Assert.Contains(index.Items, i => i.SourceType == KnowledgeSourceType.PageElement);
        }

        [Fact]
        public void Index_Build_ContainsPageActions()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            Assert.Contains(index.Items, i => i.SourceType == KnowledgeSourceType.PageAction);
        }

        [Fact]
        public void Index_Build_ContainsStepDefinitions()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            Assert.Contains(index.Items, i => i.SourceType == KnowledgeSourceType.StepDefinition);
        }

        [Fact]
        public void Index_Build_ContainsFeatureFiles()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            Assert.Contains(index.Items, i => i.SourceType == KnowledgeSourceType.FeatureFile);
        }

        [Fact]
        public void Index_Build_ContainsPageRelationship()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            Assert.Contains(index.Items, i => i.SourceType == KnowledgeSourceType.PageRelationship);
        }

        [Fact]
        public void Index_AllPageElements_HaveSourcePath()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var elements = index.BySourceType(KnowledgeSourceType.PageElement).ToList();
            Assert.All(elements, e => Assert.False(string.IsNullOrEmpty(e.SourcePath)));
        }

        [Fact]
        public void Index_AllPageActions_HaveSourcePath()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var actions = index.BySourceType(KnowledgeSourceType.PageAction).ToList();
            Assert.All(actions, a => Assert.False(string.IsNullOrEmpty(a.SourcePath)));
        }

        [Fact]
        public void Index_DirectItemsAreNotInferred()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            // PageElements and PageActions are directly sourced
            var direct = index.Items.Where(i =>
                i.SourceType == KnowledgeSourceType.PageElement ||
                i.SourceType == KnowledgeSourceType.PageAction).ToList();
            Assert.All(direct, d => Assert.False(d.IsInferred));
        }

        [Fact]
        public void Index_PageRelationships_AreMarkedInferred()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var rels = index.BySourceType(KnowledgeSourceType.PageRelationship).ToList();
            Assert.All(rels, r => Assert.True(r.IsInferred));
        }

        [Fact]
        public void Index_ByPage_ReturnsMatchingItems()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var items = index.ByPage("Dashboard").ToList();
            Assert.NotEmpty(items);
            Assert.All(items, i => Assert.Contains("Dashboard", i.RelevantPages));
        }

        [Fact]
        public void Index_ByPage_WrongPage_ReturnsEmpty()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var items = index.ByPage("Login").ToList();
            Assert.Empty(items);
        }

        [Fact]
        public void Index_ByLocator_ReturnsMatchingItems()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var items = index.ByLocator("#btnSearch").ToList();
            Assert.NotEmpty(items);
        }

        [Fact]
        public void Index_EmptyRepo_ProducesEmptyIndex()
        {
            var empty = new RepositoryKnowledgeModel
            {
                RepositoryRoot  = "Empty",
                LastScanTime    = DateTime.UtcNow.ToString("O"),
                PageElements    = new(),
                PageActions     = new(),
                StepDefinitions = new()
            };
            var index = new KnowledgeIndexService().Build(empty);
            Assert.True(index.IsEmpty);
        }

        // ===========================
        // KnowledgeRetrievalService
        // ===========================

        [Fact]
        public void Retrieval_WithMatchingPage_ReturnsItems()
        {
            var index  = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var svc    = new KnowledgeRetrievalService();
            var result = svc.Retrieve(index,
                new[] { "Dashboard" },
                new[] { Action("click", "Dashboard") });

            Assert.False(result.IsEmpty);
        }

        [Fact]
        public void Retrieval_WithNonMatchingPage_ReturnsEmpty()
        {
            var index  = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var svc    = new KnowledgeRetrievalService();
            var result = svc.Retrieve(index,
                new[] { "Login" },    // Dashboard repo, Login page signal
                new[] { Action("click", "Login") });

            Assert.True(result.IsEmpty);
        }

        [Fact]
        public void Retrieval_NullIndex_ReturnsEmptyResult()
        {
            var svc    = new KnowledgeRetrievalService();
            var result = svc.Retrieve(null, new[] { "Dashboard" }, Array.Empty<RecordedActionIntelligence>());

            Assert.True(result.IsEmpty);
            Assert.Equal("NOT_AVAILABLE", result.Metrics.TokenMeasurement);
        }

        [Fact]
        public void Retrieval_ByLocator_ReturnsMatchingElements()
        {
            var index  = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var svc    = new KnowledgeRetrievalService();
            var result = svc.Retrieve(index,
                new string[0],   // no page signal
                new[] { Action("click", null, "#btnSearch") });

            Assert.Contains(result.Items, i => i.LocatorValue == "#btnSearch");
        }

        [Fact]
        public void Retrieval_WithRoleLocatorSyntaxVariance_ReturnsRepositoryEvidence()
        {
            var index = new KnowledgeIndexService().Build(BuildDocumentAdminRepo());
            var svc = new KnowledgeRetrievalService();
            var result = svc.Retrieve(index,
                Array.Empty<string>(),
                new[]
                {
                    new RecordedActionIntelligence
                    {
                        Sequence = 0,
                        ActionType = "click",
                        Target = "Administration",
                        LocatorType = "role",
                        LocatorValue = "getByRole('link', { name: 'Administration' })",
                        GetByRoleName = "Administration",
                        InferredPageContext = "Administration"
                    }
                });

            Assert.Contains(result.Items, i => i.ComponentName == "AdministrationLink");
            Assert.Contains(result.Items, i => i.ComponentName == "ClickAdministrationLinkAsync");
        }

        [Fact]
        public void Retrieval_WhenPageInferenceMisses_CanRecoverPageFromRealLocatorSignals()
        {
            var index = new KnowledgeIndexService().Build(BuildDocumentAdminRepo());
            var svc = new KnowledgeRetrievalService();
            var result = svc.Retrieve(index,
                new[] { "ReassignPackages" },
                new[]
                {
                    new RecordedActionIntelligence
                    {
                        Sequence = 0,
                        ActionType = "selectOption",
                        Target = "SearchUserDropdown",
                        LocatorType = "id",
                        LocatorValue = "#ctl00_ContentPlaceHolder1_ddlSearchUser",
                        InferredPageContext = "ReassignPackages"
                    }
                });

            Assert.Contains(result.Items, i => i.ComponentName == "SearchUserDropdown");
            Assert.Contains(result.Items, i => i.ComponentName == "ViewDashboard");
            Assert.Contains("ViewDashboard", result.Metrics.InferredPages);
        }

        [Fact]
        public void Retrieval_IsDeterministic_SameInputSameOutput()
        {
            var index = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var svc   = new KnowledgeRetrievalService();
            var pages = new[] { "Dashboard" };
            var acts  = new[] { Action("click", "Dashboard") };

            var r1 = svc.Retrieve(index, pages, acts);
            var r2 = svc.Retrieve(index, pages, acts);

            Assert.Equal(r1.Items.Count, r2.Items.Count);
            Assert.Equal(
                r1.Items.Select(i => i.Id),
                r2.Items.Select(i => i.Id));
        }

        [Fact]
        public void Retrieval_Metrics_TotalIndexedMatchesIndex()
        {
            var index  = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var svc    = new KnowledgeRetrievalService();
            var result = svc.Retrieve(index, new[] { "Dashboard" }, new[] { Action("click", "Dashboard") });

            Assert.Equal(index.TotalItems, result.Metrics.TotalIndexedItems);
        }

        [Fact]
        public void Retrieval_Metrics_RetrievedLessOrEqualTotal()
        {
            var index  = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var svc    = new KnowledgeRetrievalService();
            var result = svc.Retrieve(index, new[] { "Dashboard" }, new[] { Action("click", "Dashboard") });

            Assert.True(result.Metrics.RetrievedItems <= result.Metrics.TotalIndexedItems);
        }

        [Fact]
        public void Retrieval_Metrics_TokenMeasurementIsNotAvailable()
        {
            var index  = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var svc    = new KnowledgeRetrievalService();
            var result = svc.Retrieve(index, new[] { "Dashboard" }, new[] { Action("click", "Dashboard") });

            Assert.Equal("NOT_AVAILABLE", result.Metrics.TokenMeasurement);
        }

        [Fact]
        public void Retrieval_Metrics_InferredPagesAreRecorded()
        {
            var index  = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var svc    = new KnowledgeRetrievalService();
            var pages  = new[] { "Dashboard" };
            var result = svc.Retrieve(index, pages, new[] { Action("click", "Dashboard") });

            Assert.Equal(1, result.Metrics.InferredPageCount);
            Assert.Contains("Dashboard", result.Metrics.InferredPages);
        }

        [Fact]
        public void Retrieval_Metrics_SourceTypesListed()
        {
            var index  = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var svc    = new KnowledgeRetrievalService();
            var result = svc.Retrieve(index, new[] { "Dashboard" }, new[] { Action("click", "Dashboard") });

            Assert.NotEmpty(result.Metrics.SourceTypes);
        }

        [Fact]
        public void Retrieval_NoFabricatedKnowledge_OnlyRepositoryItems()
        {
            // Every retrieved item must have been built from the index
            var repo   = BuildRepo("Dashboard");
            var index  = new KnowledgeIndexService().Build(repo);
            var svc    = new KnowledgeRetrievalService();
            var result = svc.Retrieve(index, new[] { "Dashboard" }, new[] { Action("click", "Dashboard") });

            // All item IDs must appear in the index
            var indexIds = index.Items.Select(i => i.Id).ToHashSet();
            Assert.All(result.Items, item => Assert.Contains(item.Id, indexIds));
        }

        [Fact]
        public void Retrieval_SourceTraceability_AllItemsHaveSourceType()
        {
            var index  = new KnowledgeIndexService().Build(BuildRepo("Dashboard"));
            var svc    = new KnowledgeRetrievalService();
            var result = svc.Retrieve(index, new[] { "Dashboard" }, new[] { Action("click", "Dashboard") });

            // SourceType is an enum — always set; Description must be non-empty
            Assert.All(result.Items, i => Assert.False(string.IsNullOrEmpty(i.Description)));
        }
    }
}
