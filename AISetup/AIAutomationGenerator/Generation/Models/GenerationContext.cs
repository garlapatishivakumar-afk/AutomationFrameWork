using System;
using System.Collections.Generic;
using AIAutomationGenerator.Intelligence.Models;
using AIAutomationGenerator.Models;

namespace AIAutomationGenerator.Generation.Models
{
    /// <summary>
    /// Compact generation context containing only information required to generate current automation.
    /// Built from AutomationIntelligenceModel, repository index, and architecture decisions.
    /// Designed to minimize token usage when passed to AI.
    /// </summary>
    public class GenerationContext
    {
        public string AnalysisId { get; set; } = Guid.NewGuid().ToString();
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Recording and intelligence
        public RecordingIntelligenceModel Recording { get; set; }
        public List<BusinessFlowIntelligence> DetectedFlows { get; set; } = new();

        // Architecture decisions (REUSE/EXTEND/CREATE)
        public List<GenerationComponentPlan> ComponentPlans { get; set; } = new();

        // Relevant framework references (NOT full source code)
        public List<PageElementInfo> RelevantPageElements { get; set; } = new();
        public List<PageActionInfo> RelevantPageActions { get; set; } = new();
        public List<StepDefinitionInfo> RelevantSteps { get; set; } = new();

        // Target files to create/modify
        public List<GenerationTarget> TargetFiles { get; set; } = new();

        // Framework conventions for this generation
        public FrameworkConventions Conventions { get; set; }

        // Summary
        public int TotalComponentsToGenerate => ComponentPlans.Count;
        public int ReuseCount => ComponentPlans.FindAll(p => p.Recommendation == "REUSE").Count;
        public int ExtendCount => ComponentPlans.FindAll(p => p.Recommendation == "EXTEND").Count;
        public int CreateCount => ComponentPlans.FindAll(p => p.Recommendation == "CREATE").Count;

        public bool HasAnyGeneration => ExtendCount > 0 || CreateCount > 0;
    }

    /// <summary>
    /// Single component plan (Feature, StepDefinition, PageElement, PageAction).
    /// Represents one REUSE/EXTEND/CREATE decision.
    /// </summary>
    public class GenerationComponentPlan
    {
        public string ComponentType { get; set; } // "Feature", "StepDefinition", "PageElement", "PageAction"
        public string ComponentName { get; set; }
        public string Recommendation { get; set; } // "REUSE", "EXTEND", "CREATE"
        public string TargetFile { get; set; } // Full path for CREATE, or existing file for EXTEND
        public string TargetClass { get; set; } // Class to extend or create
        public string TargetNamespace { get; set; }
        public double ConfidenceScore { get; set; }
        public string Rationale { get; set; }

        // Dependencies on other plans (for ordering)
        public List<string> DependsOnComponents { get; set; } = new(); // e.g., ["PageElement:SearchQueueButton"]
        public List<string> RequiredByComponents { get; set; } = new();

        // For CREATE: what to generate
        public GenerationSpec Spec { get; set; }
    }

    /// <summary>
    /// Specification for what to generate (when Recommendation = CREATE or EXTEND).
    /// </summary>
    public class GenerationSpec
    {
        // Feature
        public string FeatureName { get; set; }
        public string FeatureDescription { get; set; }
        public List<GherkinScenario> Scenarios { get; set; } = new();

        // StepDefinition / PageElement / PageAction
        public string MemberName { get; set; }
        public string MemberType { get; set; } // "Method", "Property", "Locator"
        public string ReturnType { get; set; }
        public List<MethodParameter> Parameters { get; set; } = new();
        public string Summary { get; set; }
        public bool IsAsync { get; set; }

        // Implementation hints (not full implementation)
        public string ImplementationHint { get; set; } // e.g., "Click by getByRole('button', { name: 'Search Queue' })"
        public List<string> RelatedLocators { get; set; } = new();
        public List<string> RelatedPageActions { get; set; } = new();
    }

    public class GherkinScenario
    {
        public string Name { get; set; }
        public List<GherkinStep> Steps { get; set; } = new();
    }

    public class GherkinStep
    {
        public string Type { get; set; } // "Given", "When", "Then", "And", "But"
        public string Text { get; set; }
    }

    public class MethodParameter
    {
        public string Name { get; set; }
        public string Type { get; set; }
    }

    /// <summary>
    /// Target file for generation (CREATE or EXTEND).
    /// </summary>
    public class GenerationTarget
    {
        public string FilePath { get; set; }
        public string ClassName { get; set; }
        public string Namespace { get; set; }
        public string Action { get; set; } // "CREATE" or "EXTEND"
        public List<string> MembersToAdd { get; set; } = new();
    }

    /// <summary>
    /// Framework conventions extracted from repository.
    /// Used to ensure generated code matches existing patterns.
    /// </summary>
    public class FrameworkConventions
    {
        // Namespaces
        public string PageElementsNamespace { get; set; } = "AutomationFrameWork.PageElements";
        public string PageActionsNamespace { get; set; } = "AutomationFrameWork.PageActions";
        public string StepDefinitionsNamespace { get; set; } = "AutomationFrameWork.StepDefinitions";
        public string FeaturesDirectory { get; set; } = "Features";

        // Naming
        public string PageElementFileSuffix { get; set; } = "Objects";
        public string PageActionFileSuffix { get; set; } = "Methods";
        public string StepDefinitionFileSuffix { get; set; } = "Steps";

        // Locator style (extracted from repository)
        public List<string> PreferredLocatorTypes { get; set; } = new() { "Role", "Css", "Text" };

        // Async conventions
        public bool UseAsync { get; set; } = true;
        public bool UseTaskAwait { get; set; } = true;

        // Dependencies
        public List<string> CommonUsings { get; set; } = new()
        {
            "using System;",
            "using System.Threading.Tasks;",
            "using Microsoft.Playwright;",
            "using Reqnroll;",
            "using Xunit;",
        };

        // Code generation
        public bool GenerateXmlDocs { get; set; } = true;
        public string IndentationStyle { get; set; } = "    "; // 4 spaces
    }
}
