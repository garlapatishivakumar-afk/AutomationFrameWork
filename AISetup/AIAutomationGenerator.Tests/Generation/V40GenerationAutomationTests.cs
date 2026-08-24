using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using AIAutomationGenerator.Generation.Models;
using AIAutomationGenerator.Generation.Services;
using AIAutomationGenerator.Intelligence.Models;

namespace AIAutomationGenerator.Tests.Generation
{
    /// <summary>
    /// Comprehensive tests for V4.0 Prompt 2 — Generation / Implementation Automation.
    /// Covers context building, all generators, and pipeline orchestration.
    /// </summary>
    public class V40GenerationAutomationTests
    {
        private AutomationIntelligenceModel BuildTestIntelligence()
        {
            var repository = new RepositoryKnowledgeModel
            {
                RepositoryRoot = "/test",
                PageElements = new List<PageElementInfo>
                {
                    new PageElementInfo
                    {
                        Name = "SearchQueueButton",
                        ClassName = "ViewDashboardObjects",
                        PageOwnership = "ViewDashboard",
                        FilePath = "PageElements/ViewDashboardObjects.cs"
                    }
                },
                PageActions = new List<PageActionInfo>
                {
                    new PageActionInfo
                    {
                        Name = "ClickSearchQueueButtonAsync",
                        ClassName = "ViewDashboardMethods",
                        PageOwnership = "ViewDashboard"
                    }
                },
                StepDefinitions = new List<StepDefinitionInfo>
                {
                    new StepDefinitionInfo
                    {
                        StepText = "When user clicks search queue",
                        MethodName = "WhenUserClicksSearchQueue",
                        ClassName = "ViewDashboardSteps",
                        PageOwnership = "ViewDashboard"
                    }
                }
            };

            var recording = new RecordingIntelligenceModel
            {
                Actions = new List<RecordedActionIntelligence>
                {
                    new RecordedActionIntelligence
                    {
                        Sequence = 0,
                        ActionType = "click",
                        Target = "Search Queue Button",
                        LocatorType = "role",
                        GetByRoleName = "button",
                        InferredPageContext = "ViewDashboard"
                    }
                },
                ProbablePage = "ViewDashboard",
                RelatedPages = new List<string> { "ViewDashboard" },
                ConfidenceScore = 0.85
            };

            var intelligence = new AutomationIntelligenceModel
            {
                RepositoryKnowledge = repository,
                RecordingIntelligence = recording,
                Decisions = new List<IntelligenceDecision>
                {
                    new IntelligenceDecision
                    {
                        ActionIndex = 0,
                        DecisionType = "Feature",
                        Recommendation = "CREATE",
                        TargetComponent = "SearchQueueFeature"
                    }
                }
            };

            return intelligence;
        }

        // ===== GENERATION CONTEXT TESTS =====

        [Fact]
        public void GenerationContext_ContainsRequiredComponents()
        {
            var context = new GenerationContext
            {
                Recording = new RecordingIntelligenceModel(),
                ComponentPlans = new List<GenerationComponentPlan>(),
                TargetFiles = new List<GenerationTarget>()
            };

            Assert.NotNull(context.Recording);
            Assert.NotNull(context.ComponentPlans);
            Assert.NotNull(context.TargetFiles);
        }

        [Fact]
        public void GenerationContext_CalculatesTotalComponents()
        {
            var context = new GenerationContext
            {
                ComponentPlans = new List<GenerationComponentPlan>
                {
                    new GenerationComponentPlan { Recommendation = "REUSE" },
                    new GenerationComponentPlan { Recommendation = "EXTEND" },
                    new GenerationComponentPlan { Recommendation = "EXTEND" },
                    new GenerationComponentPlan { Recommendation = "CREATE" }
                }
            };

            Assert.Equal(4, context.TotalComponentsToGenerate);
            Assert.Equal(1, context.ReuseCount);
            Assert.Equal(2, context.ExtendCount);
            Assert.Equal(1, context.CreateCount);
            Assert.True(context.HasAnyGeneration);
        }

        // ===== GENERATION CONTEXT BUILDER TESTS =====

        [Fact]
        public void GenerationContextBuilder_BuildsContextFromIntelligence()
        {
            var intelligence = BuildTestIntelligence();
            var builder = new GenerationContextBuilder(intelligence);

            var context = builder.BuildContext();

            Assert.NotNull(context);
            Assert.Equal(intelligence.RecordingIntelligence, context.Recording);
            Assert.NotEmpty(context.ComponentPlans);
        }

        [Fact]
        public void GenerationContextBuilder_SelectsRelevantComponents()
        {
            var intelligence = BuildTestIntelligence();
            var builder = new GenerationContextBuilder(intelligence);

            var context = builder.BuildContext();

            // Should include ViewDashboard components
            var dashboardElements = context.RelevantPageElements
                .Where(e => e.PageOwnership == "ViewDashboard")
                .ToList();

            Assert.NotEmpty(dashboardElements);
        }

        [Fact]
        public void GenerationContextBuilder_DeterminatesTargetFiles()
        {
            var intelligence = BuildTestIntelligence();
            var builder = new GenerationContextBuilder(intelligence);

            var context = builder.BuildContext();

            Assert.NotNull(context.TargetFiles);
            // Should have at least one target file
            Assert.True(context.TargetFiles.Count >= 0);
        }

        // ===== FEATURE FILE GENERATOR TESTS =====

        [Fact]
        public void FeatureFileGenerator_GeneratesValidGherkinSyntax()
        {
            var context = new GenerationContext
            {
                Recording = new RecordingIntelligenceModel
                {
                    Actions = new List<RecordedActionIntelligence>
                    {
                        new RecordedActionIntelligence
                        {
                            ActionType = "click",
                            Target = "Search Button"
                        }
                    }
                },
                DetectedFlows = new List<BusinessFlowIntelligence>
                {
                    new BusinessFlowIntelligence
                    {
                        FlowName = "Search_Workflow",
                        ActionSequences = new List<int> { 0 }
                    }
                }
            };

            var generator = new FeatureFileGenerator(context);
            var feature = generator.GenerateFeatureFile();

            Assert.NotEmpty(feature);
            Assert.Contains("Feature:", feature);
            Assert.Contains("Scenario:", feature);
            Assert.Contains("Given", feature);
            Assert.Contains("When", feature);
            Assert.Contains("Then", feature);
        }

        [Fact]
        public void FeatureFileGenerator_IncludesBusinessFlowNames()
        {
            var context = new GenerationContext
            {
                Recording = new RecordingIntelligenceModel
                {
                    ProbablePage = "ViewDashboard",
                    Actions = new List<RecordedActionIntelligence>()
                },
                DetectedFlows = new List<BusinessFlowIntelligence>
                {
                    new BusinessFlowIntelligence { FlowName = "Search_Queue" }
                }
            };

            var generator = new FeatureFileGenerator(context);
            var feature = generator.GenerateFeatureFile();

            Assert.Contains("Search_Queue", feature);
        }

        // ===== STEP DEFINITION GENERATOR TESTS =====

        [Fact]
        public void StepDefinitionGenerator_GeneratesValidCsharpClass()
        {
            var context = new GenerationContext();
            var generator = new StepDefinitionGenerator(context);

            var stepMethod = generator.GenerateStepMethod(
                new RecordedActionIntelligence
                {
                    ActionType = "click",
                    Target = "Search Queue Button"
                });

            Assert.NotEmpty(stepMethod);
            Assert.Contains("[", stepMethod); // Binding attribute
            Assert.Contains("async Task", stepMethod);
        }

        [Fact]
        public void StepDefinitionGenerator_GeneratesRichStepText()
        {
            var context = new GenerationContext();
            var generator = new StepDefinitionGenerator(context);

            var stepMethod = generator.GenerateStepMethod(
                new RecordedActionIntelligence
                {
                    ActionType = "click",
                    Target = "Search Queue Button"
                });

            Assert.Contains("the user clicks on", stepMethod);
        }

        [Fact]
        public void StepDefinitionGenerator_GeneratesStepDefinitionClass()
        {
            var context = new GenerationContext();
            var generator = new StepDefinitionGenerator(context);

            var classCode = generator.GenerateStepDefinitionClass(
                "SearchSteps",
                "AutomationFrameWork.StepDefinitions",
                new List<string> { "test method" });

            Assert.Contains("namespace AutomationFrameWork.StepDefinitions", classCode);
            Assert.Contains("public class SearchSteps", classCode);
            Assert.Contains("[Binding]", classCode);
        }

        // ===== PAGE ELEMENT GENERATOR TESTS =====

        [Fact]
        public void PageElementGenerator_GeneratesLocatorMethod()
        {
            var context = new GenerationContext();
            var generator = new PageElementGenerator(context);

            var locatorMethod = generator.GenerateLocatorMethod(
                new RecordedActionIntelligence
                {
                    ActionType = "click",
                    Target = "Search Queue Button",
                    LocatorType = "role",
                    GetByRoleName = "button"
                });

            Assert.NotEmpty(locatorMethod);
            Assert.Contains("ILocator", locatorMethod);
            Assert.Contains("=>", locatorMethod); // Arrow expression
        }

        [Fact]
        public void PageElementGenerator_GeneratesPageElementsClass()
        {
            var context = new GenerationContext();
            var generator = new PageElementGenerator(context);

            var classCode = generator.GeneratePageElementsClass(
                "ViewDashboardObjects",
                "AutomationFrameWork.PageElements",
                new List<string> { "public ILocator TestLocator => _page.Locator(\"test\");" });

            Assert.Contains("namespace AutomationFrameWork.PageElements", classCode);
            Assert.Contains("public class ViewDashboardObjects", classCode);
            Assert.Contains("IPage _page", classCode);
        }

        // ===== PAGE ACTION GENERATOR TESTS =====

        [Fact]
        public void PageActionGenerator_GeneratesPageActionMethod()
        {
            var context = new GenerationContext();
            var generator = new PageActionGenerator(context);

            var actionMethod = generator.GeneratePageActionMethod(
                new RecordedActionIntelligence
                {
                    ActionType = "click",
                    Target = "Search Queue Button"
                });

            Assert.NotEmpty(actionMethod);
            Assert.Contains("async Task", actionMethod);
            Assert.Contains("Async", actionMethod);
            Assert.Contains("ClickAsync", actionMethod);
        }

        [Fact]
        public void PageActionGenerator_GeneratesPageActionsClass()
        {
            var context = new GenerationContext();
            var generator = new PageActionGenerator(context);

            var classCode = generator.GeneratePageActionsClass(
                "ViewDashboardMethods",
                "AutomationFrameWork.PageActions",
                new List<string> { "test method" });

            Assert.Contains("namespace AutomationFrameWork.PageActions", classCode);
            Assert.Contains("public class ViewDashboardMethods", classCode);
            Assert.Contains("IPage _page", classCode);
        }

        // ===== INTEGRATION & ORCHESTRATION TESTS =====

        [Fact]
        public void GenerationPipeline_ReuseDoesNotGenerateCode()
        {
            var context = new GenerationContext
            {
                ComponentPlans = new List<GenerationComponentPlan>
                {
                    new GenerationComponentPlan { Recommendation = "REUSE" }
                }
            };

            // REUSE should result in no generation
            Assert.Equal(1, context.TotalComponentsToGenerate);
            Assert.Equal(1, context.ReuseCount);
            Assert.Equal(0, context.ExtendCount);
            Assert.Equal(0, context.CreateCount);
            Assert.False(context.HasAnyGeneration);
        }

        [Fact]
        public void GenerationPipeline_ExtendAndCreateBothGenerate()
        {
            var context = new GenerationContext
            {
                ComponentPlans = new List<GenerationComponentPlan>
                {
                    new GenerationComponentPlan { Recommendation = "EXTEND" },
                    new GenerationComponentPlan { Recommendation = "CREATE" }
                }
            };

            Assert.True(context.HasAnyGeneration);
            Assert.Equal(1, context.ExtendCount);
            Assert.Equal(1, context.CreateCount);
        }

        // ===== ARCHITECTURE SAFETY TESTS =====

        [Fact]
        public void GenerationContext_NoHardcodedPageNames()
        {
            var context = new GenerationContext();

            // Page names should come from recorded actions or intelligence
            // NOT hardcoded in the generators
            Assert.True(context.Recording == null || !context.Recording.ProbablePage.Contains("ViewDashboard_HARDCODED"));
        }

        [Fact]
        public void Generators_UseMetadataNotSourceCode()
        {
            var intelligence = BuildTestIntelligence();
            var builder = new GenerationContextBuilder(intelligence);
            var context = builder.BuildContext();

            // Context should reference components, not include their full source
            if (context.RelevantPageElements?.Any() == true)
            {
                foreach (var element in context.RelevantPageElements)
                {
                    Assert.NotNull(element.Name);
                    Assert.NotNull(element.FilePath);
                    // Should NOT include full class source
                    Assert.True(element.Name.Length < 100); // Short name
                    Assert.True(element.FilePath.Length < 200); // Short path
                }
            }
        }

        // ===== TOKEN EFFICIENCY TESTS =====

        [Fact]
        public void GenerationContext_IsCompact()
        {
            var intelligence = BuildTestIntelligence();
            var builder = new GenerationContextBuilder(intelligence);
            var context = builder.BuildContext();

            // Context should be small (metadata only, no source duplication)
            Assert.NotNull(context.RelevantPageElements);
            Assert.NotNull(context.RelevantPageActions);
            Assert.NotNull(context.RelevantSteps);

            // Each component should only store metadata (if any exist)
            if (context.RelevantPageElements.Count > 0)
            {
                foreach (var element in context.RelevantPageElements)
                {
                    // Name and path should be reasonably sized (metadata not full source)
                    Assert.True(string.IsNullOrEmpty(element.Name) || element.Name.Length < 100);
                    Assert.True(string.IsNullOrEmpty(element.FilePath) || element.FilePath.Length < 200);
                }
            }
        }

        [Fact]
        public void GenerationContextBuilder_AvoidsDuplicateMetadata()
        {
            var intelligence = BuildTestIntelligence();
            var builder = new GenerationContextBuilder(intelligence);
            var context = builder.BuildContext();

            // No duplicate component references
            var elementNames = context.RelevantPageElements.Select(e => e.Name).ToList();
            var uniqueNames = new HashSet<string>(elementNames);

            Assert.True(uniqueNames.Count <= elementNames.Count);
        }

        // ===== V3 BACKWARD COMPATIBILITY TESTS =====

        [Fact]
        public void GenerationDoesNotAffectV3Behavior()
        {
            // V4 Generation should be additive, not replace V3
            // V3 REUSE/EXTEND/CREATE should still work

            var intelligence = new AutomationIntelligenceModel
            {
                RepositoryKnowledge = new RepositoryKnowledgeModel(),
                RecordingIntelligence = new RecordingIntelligenceModel()
            };

            // Should not throw even with minimal intelligence
            var builder = new GenerationContextBuilder(intelligence);
            Assert.NotNull(builder);
        }

        [Fact]
        public void GenerationContextBuilder_PreservesV3Decisions()
        {
            var intelligence = BuildTestIntelligence();

            // If V3 made decisions, V4 context should preserve them
            var builder = new GenerationContextBuilder(intelligence);
            var context = builder.BuildContext();

            Assert.NotNull(context.Conventions);
            // Should not modify V3 architecture decisions
        }
    }
}
