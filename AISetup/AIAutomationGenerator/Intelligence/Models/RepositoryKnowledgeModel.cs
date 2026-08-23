using System;
using System.Collections.Generic;

namespace AIAutomationGenerator.Intelligence.Models
{
    /// <summary>
    /// Compact repository knowledge model representing the complete automation framework structure.
    /// Designed for minimum token usage and efficient queries.
    /// </summary>
    public class RepositoryKnowledgeModel
    {
        public string RepositoryRoot { get; set; }
        public string LastScanTime { get; set; }
        public string RepositorySignature { get; set; } // For change detection

        // Framework structure metadata
        public FrameworkStructureInfo FrameworkStructure { get; set; }

        // Indexed components
        public List<PageElementInfo> PageElements { get; set; } = new();
        public List<PageActionInfo> PageActions { get; set; } = new();
        public List<StepDefinitionInfo> StepDefinitions { get; set; } = new();
        public List<FeatureFileInfo> Features { get; set; } = new();

        // Relationships
        public List<PageComponentRelationship> PageRelationships { get; set; } = new();
        public int TotalPages => new HashSet<string>(PageRelationships.ConvertAll(r => r.PageName)).Count;
    }

    public class FrameworkStructureInfo
    {
        public string PageElementsDirectory { get; set; }
        public string PageActionsDirectory { get; set; }
        public string StepDefinitionsDirectory { get; set; }
        public string FeaturesDirectory { get; set; }
        public string HelpersDirectory { get; set; }
        public string UtilitiesDirectory { get; set; }
        public string ConfigurationLocations { get; set; }
    }

    /// <summary>
    /// Lightweight PageElement metadata (properties/methods that return ILocator).
    /// Stores reference, not full source.
    /// </summary>
    public class PageElementInfo
    {
        public string Name { get; set; }
        public string ClassName { get; set; }
        public string Namespace { get; set; }
        public string FilePath { get; set; }
        public string LocatorType { get; set; } // "Role", "Css", "Text", "ID", etc.
        public string Selector { get; set; }
        public string PageOwnership { get; set; } // e.g., "ViewDashboard"
        public bool IsMethod { get; set; } // true if method, false if property
        public double ConfidenceScore { get; set; }
    }

    /// <summary>
    /// Lightweight PageAction method metadata.
    /// Stores reference, not full source.
    /// </summary>
    public class PageActionInfo
    {
        public string Name { get; set; }
        public string ClassName { get; set; }
        public string Namespace { get; set; }
        public string FilePath { get; set; }
        public string Parameters { get; set; } // Compact param list
        public bool IsAsync { get; set; }
        public string PageOwnership { get; set; } // e.g., "ViewDashboard"
        public double ConfidenceScore { get; set; }
    }

    /// <summary>
    /// Lightweight StepDefinition metadata.
    /// Stores reference, not full source.
    /// </summary>
    public class StepDefinitionInfo
    {
        public string StepText { get; set; }
        public string MethodName { get; set; }
        public string ClassName { get; set; }
        public string Namespace { get; set; }
        public string FilePath { get; set; }
        public string StepType { get; set; } // "Given", "When", "Then", "And", "But"
        public string PageOwnership { get; set; } // e.g., "ViewDashboard"
        public double ConfidenceScore { get; set; }
    }

    /// <summary>
    /// Feature file metadata with scenario/step references.
    /// </summary>
    public class FeatureFileInfo
    {
        public string FeatureName { get; set; }
        public string FilePath { get; set; }
        public List<ScenarioReference> Scenarios { get; set; } = new();
        public List<string> RelatedPages { get; set; } = new();
    }

    public class ScenarioReference
    {
        public string ScenarioName { get; set; }
        public List<string> StepTexts { get; set; } = new(); // Gherkin steps
    }

    /// <summary>
    /// Relationship between a Page and its framework components.
    /// Enables efficient queries like "GetPageElements(ViewDashboard)".
    /// </summary>
    public class PageComponentRelationship
    {
        public string PageName { get; set; } // e.g., "ViewDashboard"
        public List<string> PageElementFiles { get; set; } = new(); // e.g., ["ViewDashboardObjects.cs"]
        public List<string> PageActionFiles { get; set; } = new(); // e.g., ["ViewDashboardMethods.cs"]
        public List<string> StepDefinitionFiles { get; set; } = new(); // e.g., ["ViewDashboardSteps.cs"]
        public List<string> FeatureFiles { get; set; } = new(); // e.g., ["ViewDashboard.feature"]
        public string Namespace { get; set; } // Common namespace
        public double ConfidenceScore { get; set; }
    }
}
