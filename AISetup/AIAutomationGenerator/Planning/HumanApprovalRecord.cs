using System;

namespace AIAutomationGenerator.Planning
{
    /// <summary>
    /// Records an explicit human-approved resolution for a single HUMAN_REVIEW_REQUIRED decision.
    ///
    /// This model carries the human's decision from the review session into the plan
    /// so the orchestrator can unlock actions that S5 flagged for review.
    ///
    /// IMPORTANT:
    ///   - This does NOT weaken the S5 safety gate.
    ///   - S5 still evaluates all decisions and flags ambiguities correctly.
    ///   - Only after S5 has produced its HR result, and only when the human has
    ///     provided explicit written approvals (ApprovedBy + Rationale), are the
    ///     resolutions applied by HumanApprovalService.
    ///   - The approval is scoped to a single RunId and ActionIndex.
    ///   - HumanApprovalService rejects any approval that targets a non-HR decision.
    /// </summary>
    public class HumanApprovalRecord
    {
        /// <summary>Action index in the original recording (0-based).</summary>
        public int ActionIndex { get; set; }

        /// <summary>Human-readable description of the recorded action being resolved.</summary>
        public string ActionDescription { get; set; } = string.Empty;

        /// <summary>The resolved component name (e.g. "AdministrationLink").</summary>
        public string ResolvedComponent { get; set; } = string.Empty;

        /// <summary>The source file path of the resolved component (e.g. "PageElements/ViewDashboardObjects.cs").</summary>
        public string ResolvedSourcePath { get; set; } = string.Empty;

        /// <summary>The page/class that owns the resolved component (e.g. "ViewDashboard").</summary>
        public string ResolvedPage { get; set; } = string.Empty;

        /// <summary>The method to call for this action (e.g. "ClickAdministrationLinkAsync").</summary>
        public string ResolvedMethod { get; set; } = string.Empty;

        /// <summary>The decision type the human has confirmed (normally Reuse).</summary>
        public EngineeringDecisionType ResolvedDecisionType { get; set; } = EngineeringDecisionType.Reuse;

        /// <summary>Human-written rationale for the selection (required).</summary>
        public string Rationale { get; set; } = string.Empty;

        /// <summary>Identifier of the human approver (required — cannot be empty).</summary>
        public string ApprovedBy { get; set; } = string.Empty;

        /// <summary>UTC timestamp of the approval.</summary>
        public DateTime ApprovedAt { get; set; } = DateTime.UtcNow;
    }
}
