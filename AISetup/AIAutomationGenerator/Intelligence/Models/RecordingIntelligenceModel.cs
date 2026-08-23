using System;
using System.Collections.Generic;

namespace AIAutomationGenerator.Intelligence.Models
{
    /// <summary>
    /// Compact representation of a Playwright Codegen recording.
    /// Extracts only the intelligence needed for architecture decisions and generation.
    /// Does NOT store full source or duplicate the recording.
    /// </summary>
    public class RecordingIntelligenceModel
    {
        public List<RecordedActionIntelligence> Actions { get; set; } = new();
        public List<string> DetectedBusinessFlows { get; set; } = new();
        public string ProbablePage { get; set; }
        public List<string> RelatedPages { get; set; } = new();
        public double ConfidenceScore { get; set; }
    }

    /// <summary>
    /// Lightweight recording action with only intelligence required.
    /// </summary>
    public class RecordedActionIntelligence
    {
        public int Sequence { get; set; }
        public string ActionType { get; set; } // "click", "fill", "select", "navigate", etc.
        public string Target { get; set; } // button/input name or URL
        public string LocatorType { get; set; } // "role", "css", "id", "text", etc.
        public string LocatorValue { get; set; }
        public string GetByRoleName { get; set; } // If locator is getByRole
        public string RelatedPageElement { get; set; } // Matched existing PageElement if found
        public string RelatedPageAction { get; set; } // Matched existing PageAction if found
        public string RelatedStep { get; set; } // Matched existing step if found
        public string InferredPageContext { get; set; }
    }
}
