using System;
using System.Collections.Generic;

namespace AIAutomationGenerator.Implementation
{
    /// <summary>
    /// V7.0 P2 — Change record for every file modification attempt.
    /// Immutable audit trail.
    /// </summary>
    public class ChangeRecord
    {
        public string ChangeId         { get; init; } = Guid.NewGuid().ToString("N")[..8];
        public DateTime AttemptedAt    { get; init; } = DateTime.UtcNow;
        public string FilePath         { get; init; }
        public ChangeType ChangeType   { get; init; }
        public string DecisionSource   { get; init; }  // EngineeringDecision.ActionDescription
        public string Evidence         { get; init; }
        public string Reason           { get; init; }
        public ChangeRisk Risk         { get; init; }
        public ChangeStatus Status     { get; init; }
        public string BeforeHash       { get; init; }
        public string AfterHash        { get; init; }
        public string ErrorMessage     { get; init; }
    }

    public enum ChangeType   { Create, Extend, Reuse, Rollback }
    public enum ChangeRisk   { Low, Medium, High, Protected }
    public enum ChangeStatus { Pending, Applied, RolledBack, Skipped, HumanReviewRequired }

    /// <summary>
    /// Execution record for one full implementation run.
    /// </summary>
    public class ImplementationExecutionRecord
    {
        public string PlanId          { get; set; }
        public DateTime StartedAt     { get; set; }
        public DateTime CompletedAt   { get; set; }
        public TimeSpan Duration      => CompletedAt - StartedAt;

        public List<ChangeRecord> Changes           { get; set; } = new();
        public BuildValidationResult BuildResult    { get; set; }
        public TestValidationResult TestResult      { get; set; }

        public int   CorrectionsAttempted { get; set; }
        public int   CorrectionsSucceeded { get; set; }
        public int   Rollbacks            { get; set; }
        public int   RetryCount           { get; set; }
        public bool  FrameworkModified    { get; set; } = false;  // must stay false

        public ImplementationStatus FinalStatus      { get; set; }
        public string HumanReviewRequired            { get; set; }
        public List<string> HumanReviewNotes         { get; set; } = new();
    }

    public enum ImplementationStatus
    {
        Success,
        PartialSuccess,
        HumanReviewRequired,
        Failed,
        RolledBack
    }

    /// <summary>Lightweight build result for implementation validation.</summary>
    public class BuildValidationResult
    {
        public bool   Success        { get; set; }
        public int    ErrorCount     { get; set; }
        public string ErrorSummary   { get; set; }
        public FailureCategory FailureCategory { get; set; }
    }

    /// <summary>Lightweight test result for implementation validation.</summary>
    public class TestValidationResult
    {
        public bool   Success        { get; set; }
        public int    Passed         { get; set; }
        public int    Failed         { get; set; }
        public bool   IsRegression   { get; set; }
    }

    /// <summary>
    /// Failure categories for the implementation engine.
    /// </summary>
    public enum FailureCategory
    {
        None,
        MissingUsing,
        SyntaxError,
        TypeMismatch,
        MissingMethod,
        MissingSelector,
        LocatorFailure,
        AssertionFailure,
        EnvironmentFailure,
        AuthenticationFailure,
        TestRegression,
        ProtectedFileModification,
        Unknown
    }
}
