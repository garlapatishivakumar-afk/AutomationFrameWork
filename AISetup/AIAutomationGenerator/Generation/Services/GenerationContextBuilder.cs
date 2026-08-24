using System;
using System.Collections.Generic;
using System.Linq;
using AIAutomationGenerator.Generation.Models;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Generation.Services
{
    /// <summary>
    /// Builds compact GenerationContext from AutomationIntelligenceModel.
    /// Selects only relevant framework components to minimize context size.
    /// Prepares component plans for deterministic or AI-assisted generation.
    /// </summary>
    public class GenerationContextBuilder
    {
        private readonly AutomationIntelligenceModel _intelligence;
        private readonly FrameworkConventions _conventions;

        public GenerationContextBuilder(AutomationIntelligenceModel intelligence, FrameworkConventions conventions = null)
        {
            _intelligence = intelligence ?? throw new ArgumentNullException(nameof(intelligence));
            _conventions = conventions ?? BuildDefaultConventions();
        }

        /// <summary>
        /// Build complete generation context from intelligence model.
        /// </summary>
        public GenerationContext BuildContext()
        {
            if (!_intelligence.IsValid)
                throw new InvalidOperationException("Intelligence model is not valid for generation.");

            var context = new GenerationContext
            {
                Recording = _intelligence.RecordingIntelligence,
                DetectedFlows = _intelligence.BusinessFlows,
                Conventions = _conventions,
                ComponentPlans = BuildComponentPlans(_intelligence.Decisions),
                RelevantPageElements = SelectRelevantPageElements(_intelligence),
                RelevantPageActions = SelectRelevantPageActions(_intelligence),
                RelevantSteps = SelectRelevantSteps(_intelligence),
                TargetFiles = DetermineTargetFiles(_intelligence)
            };

            // Validate dependencies
            ValidateDependencies(context);

            return context;
        }

        /// <summary>
        /// Build component plans from architecture decisions.
        /// Maps decisions to generation specifications.
        /// </summary>
        private List<GenerationComponentPlan> BuildComponentPlans(List<IntelligenceDecision> decisions)
        {
            var plans = new List<GenerationComponentPlan>();

            if (decisions == null || decisions.Count == 0)
                return plans;

            foreach (var decision in decisions.OrderBy(d => d.ActionIndex))
            {
                var plan = new GenerationComponentPlan
                {
                    ComponentType = decision.DecisionType,
                    ComponentName = decision.TargetComponent,
                    Recommendation = decision.Recommendation,
                    TargetFile = decision.TargetFile,
                    ConfidenceScore = decision.ConfidenceScore,
                    Rationale = decision.Rationale,
                    Spec = BuildGenerationSpec(decision)
                };

                // Skip REUSE (no generation needed)
                if (decision.Recommendation != "REUSE")
                {
                    plans.Add(plan);
                }
            }

            // Order by dependency
            OrderByDependency(plans);

            return plans;
        }

        /// <summary>
        /// Build generation spec from decision.
        /// Prepares what needs to be generated.
        /// </summary>
        private GenerationSpec BuildGenerationSpec(IntelligenceDecision decision)
        {
            var spec = new GenerationSpec
            {
                Summary = decision.Rationale
            };

            if (decision.DecisionType == "Feature")
            {
                spec.FeatureName = GenerateFeatureName(decision);
                spec.FeatureDescription = BuildFeatureDescription(_intelligence.BusinessFlows);
                // Scenarios will be built by FeatureFileGenerator based on recording
            }
            else if (decision.DecisionType == "StepDefinition")
            {
                spec.MemberName = ExtractMethodName(decision.TargetComponent);
                spec.MemberType = "Method";
                spec.ReturnType = "Task";
                spec.IsAsync = true;
            }
            else if (decision.DecisionType == "PageElement")
            {
                spec.MemberName = ExtractMethodName(decision.TargetComponent);
                spec.MemberType = "Method"; // V4 generates ILocator methods
                spec.ReturnType = "ILocator";
                spec.IsAsync = false;
            }
            else if (decision.DecisionType == "PageAction")
            {
                spec.MemberName = ExtractMethodName(decision.TargetComponent);
                spec.MemberType = "Method";
                spec.ReturnType = "Task";
                spec.IsAsync = true;
            }

            return spec;
        }

        /// <summary>
        /// Select only relevant PageElements for this generation.
        /// Avoid including unrelated framework components.
        /// </summary>
        private List<PageElementInfo> SelectRelevantPageElements(AutomationIntelligenceModel intelligence)
        {
            if (intelligence?.RepositoryKnowledge?.PageElements == null)
                return new List<PageElementInfo>();

            // Pages involved in recording
            var involvedPages = intelligence.RecordingIntelligence?.RelatedPages ?? new List<string>();

            // Select locators for involved pages
            return intelligence.RepositoryKnowledge.PageElements
                .Where(e => !string.IsNullOrEmpty(e.PageOwnership) && involvedPages.Contains(e.PageOwnership))
                .ToList();
        }

        /// <summary>
        /// Select only relevant PageActions for this generation.
        /// </summary>
        private List<PageActionInfo> SelectRelevantPageActions(AutomationIntelligenceModel intelligence)
        {
            if (intelligence?.RepositoryKnowledge?.PageActions == null)
                return new List<PageActionInfo>();

            var involvedPages = intelligence.RecordingIntelligence?.RelatedPages ?? new List<string>();

            return intelligence.RepositoryKnowledge.PageActions
                .Where(a => involvedPages.Contains(a.PageOwnership))
                .ToList();
        }

        /// <summary>
        /// Select only relevant StepDefinitions for this generation.
        /// </summary>
        private List<StepDefinitionInfo> SelectRelevantSteps(AutomationIntelligenceModel intelligence)
        {
            if (intelligence?.RepositoryKnowledge?.StepDefinitions == null)
                return new List<StepDefinitionInfo>();

            var involvedPages = intelligence.RecordingIntelligence?.RelatedPages ?? new List<string>();

            return intelligence.RepositoryKnowledge.StepDefinitions
                .Where(s => involvedPages.Contains(s.PageOwnership))
                .ToList();
        }

        /// <summary>
        /// Determine which files will be created or modified.
        /// </summary>
        private List<GenerationTarget> DetermineTargetFiles(AutomationIntelligenceModel intelligence)
        {
            var targets = new List<GenerationTarget>();

            if (intelligence.Decisions == null)
                return targets;

            var processedFiles = new HashSet<string>();

            foreach (var decision in intelligence.Decisions)
            {
                if (decision.Recommendation == "REUSE")
                    continue; // No file modification for REUSE

                string filePath = decision.TargetFile;
                if (string.IsNullOrEmpty(filePath))
                    filePath = GenerateFilePath(decision);

                if (!processedFiles.Contains(filePath))
                {
                    targets.Add(new GenerationTarget
                    {
                        FilePath = filePath,
                        ClassName = ExtractClassName(decision.TargetComponent, decision.DecisionType),
                        Namespace = DetermineNamespace(decision.DecisionType),
                        Action = decision.Recommendation,
                        MembersToAdd = new List<string> { ExtractMethodName(decision.TargetComponent) }
                    });

                    processedFiles.Add(filePath);
                }
                else
                {
                    // Add member to existing target
                    var existingTarget = targets.First(t => t.FilePath == filePath);
                    existingTarget.MembersToAdd.Add(ExtractMethodName(decision.TargetComponent));
                }
            }

            return targets;
        }

        /// <summary>
        /// Validate component dependencies are satisfiable.
        /// </summary>
        private void ValidateDependencies(GenerationContext context)
        {
            // Check for circular dependencies
            foreach (var plan in context.ComponentPlans)
            {
                if (HasCircularDependency(plan, context.ComponentPlans))
                {
                    throw new InvalidOperationException($"Circular dependency detected for {plan.ComponentName}");
                }
            }
        }

        /// <summary>
        /// Order component plans by dependency (topological sort).
        /// </summary>
        private void OrderByDependency(List<GenerationComponentPlan> plans)
        {
            // Simple ordering: PageElements → PageActions → StepDefinitions → Feature
            var types = new[] { "PageElement", "PageAction", "StepDefinition", "Feature" };

            var sorted = new List<GenerationComponentPlan>();
            foreach (var type in types)
            {
                sorted.AddRange(plans.Where(p => p.ComponentType == type));
            }

            plans.Clear();
            plans.AddRange(sorted);
        }

        private bool HasCircularDependency(GenerationComponentPlan plan, List<GenerationComponentPlan> allPlans)
        {
            var visited = new HashSet<string>();
            return DfsHasCircle(plan.ComponentName, visited, allPlans);
        }

        private bool DfsHasCircle(string component, HashSet<string> visited, List<GenerationComponentPlan> allPlans)
        {
            if (visited.Contains(component))
                return true;

            visited.Add(component);

            var plan = allPlans.FirstOrDefault(p => p.ComponentName == component);
            if (plan != null)
            {
                foreach (var dep in plan.DependsOnComponents)
                {
                    if (DfsHasCircle(dep, new HashSet<string>(visited), allPlans))
                        return true;
                }
            }

            return false;
        }

        private string GenerateFeatureName(IntelligenceDecision decision)
        {
            var flowNames = _intelligence.BusinessFlows?.ConvertAll(f => f.FlowName);
            if (flowNames?.Any() == true)
                return string.Join("_", flowNames);

            return "Generated_Automation";
        }

        private string BuildFeatureDescription(List<BusinessFlowIntelligence> flows)
        {
            if (flows == null || flows.Count == 0)
                return "Automated test scenario generated from Codegen recording.";

            return $"Feature: {flows.First().FlowName} automation workflow.";
        }

        private string ExtractMethodName(string component)
        {
            // ViewDashboardObjects.SearchQueueButton → SearchQueueButton
            var parts = component?.Split('.') ?? new[] { component };
            return parts.Length > 1 ? parts[1] : (component ?? "GeneratedMethod");
        }

        private string ExtractClassName(string component, string componentType)
        {
            // ViewDashboardObjects.SearchQueueButton → ViewDashboardObjects
            var parts = component?.Split('.') ?? new[] { component };

            if (parts.Length > 1)
                return parts[0];

            // Generate from component name and type
            var name = parts.Length > 0 ? parts[0] : "GeneratedClass";
            var suffix = componentType switch
            {
                "PageElement" => _conventions.PageElementFileSuffix,
                "PageAction" => _conventions.PageActionFileSuffix,
                "StepDefinition" => _conventions.StepDefinitionFileSuffix,
                _ => ""
            };

            return name + suffix;
        }

        private string DetermineNamespace(string componentType)
        {
            return componentType switch
            {
                "PageElement" => _conventions.PageElementsNamespace,
                "PageAction" => _conventions.PageActionsNamespace,
                "StepDefinition" => _conventions.StepDefinitionsNamespace,
                "Feature" => "Features",
                _ => "AutomationFrameWork"
            };
        }

        private string GenerateFilePath(IntelligenceDecision decision)
        {
            var className = ExtractClassName(decision.TargetComponent, decision.DecisionType);
            var directory = decision.DecisionType switch
            {
                "PageElement" => "PageElements",
                "PageAction" => "PageActions",
                "StepDefinition" => "StepDefinitions",
                "Feature" => "Features",
                _ => ""
            };

            return $"{directory}/{className}.{(decision.DecisionType == "Feature" ? "feature" : "cs")}";
        }

        private FrameworkConventions BuildDefaultConventions()
        {
            return new FrameworkConventions();
        }
    }
}
