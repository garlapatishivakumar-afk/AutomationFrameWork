using System;
using System.Collections.Generic;
using AIAutomationGenerator.Knowledge;

namespace AIAutomationGenerator.Planning
{
    /// <summary>
    /// V7.0 P1 — Engineering Plan model.
    ///
    /// Converts V6.0 intelligence/evidence into a deterministic implementation plan.
    /// Every decision MUST carry evidence. No silent guessing.
    /// </summary>
    public class EngineeringPlan
    {
        public string PlanId              { get; set; } = Guid.NewGuid().ToString("N")[..8];
        public DateTime CreatedAt         { get; set; } = DateTime.UtcNow;
        public string RecordingSource     { get; set; }
        public int    RecordingActionCount { get; set; }
        public List<string> RelevantPages { get; set; } = new();
        public List<string> RelevantComponents { get; set; } = new();

        public List<EngineeringDecision> Decisions { get; set; } = new();
        public List<FilePlan> PlannedFileChanges   { get; set; } = new();
        public List<string> ProtectedFiles         { get; set; } = new();
        public List<HumanReviewQuestion> HumanReviewQuestions { get; set; } = new();

        public bool FrameworkModificationsAllowed  { get; set; } = false;
        public PlanStatus Status                   { get; set; } = PlanStatus.Draft;
        public double OverallConfidence            { get; set; }
        public List<string> HumanReviewReasons     { get; set; } = new();

        // Derived counts
        public int ReuseCount         => DecisionCount(EngineeringDecisionType.Reuse);
        public int ExtendCount        => DecisionCount(EngineeringDecisionType.Extend);
        public int CreateCount        => DecisionCount(EngineeringDecisionType.Create);
        public int HumanReviewCount   => DecisionCount(EngineeringDecisionType.HumanReviewRequired);

        private int DecisionCount(EngineeringDecisionType t) =>
            Decisions.Count(d => d.Decision == t);
    }

    public enum PlanStatus { Draft, Ready, HumanReviewRequired, Rejected }

    // ===== Decision model =====

    public class EngineeringDecision
    {
        public int    ActionIndex       { get; set; }
        public string ActionDescription { get; set; }
        public string Component         { get; set; }
        public string ComponentType     { get; set; }  // PageElement | PageAction | StepDefinition | Feature
        public EngineeringDecisionType Decision { get; set; }
        public string Reason            { get; set; }
        public string SourcePath        { get; set; }  // existing component path (REUSE/EXTEND)
        public double Confidence        { get; set; }
        public List<KnowledgeEvidence> Evidence { get; set; } = new();
        public string ExistingComponentRef { get; set; }  // for REUSE/EXTEND
        public string HumanReviewNote   { get; set; }
        public bool   HasEvidence       => Evidence.Count > 0;
    }

    public enum EngineeringDecisionType
    {
        Reuse,
        Extend,
        Create,
        HumanReviewRequired
    }

    // ===== File plan =====

    public class FilePlan
    {
        public string FilePath        { get; set; }
        public FileModificationType ModificationType { get; set; }
        public string Reason          { get; set; }
        public string Evidence        { get; set; }
        public string ExpectedImpact  { get; set; }
        public string PlannedContent  { get; set; }
        public bool   IsProtected     { get; set; }
    }

    public enum FileModificationType { Create, Extend, Reuse, Protected }
}
