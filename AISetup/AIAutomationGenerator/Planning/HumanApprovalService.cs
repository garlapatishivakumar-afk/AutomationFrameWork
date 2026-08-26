using System;
using System.Collections.Generic;
using System.Linq;

namespace AIAutomationGenerator.Planning
{
    /// <summary>
    /// Applies explicit human-approved resolutions to an EngineeringPlan after S5 evaluation.
    ///
    /// DESIGN CONTRACT:
    ///   1. S5 (EngineeringPlanner) runs first, unchanged. It flags ambiguities correctly.
    ///   2. HumanApprovalService runs AFTER S5, only when the orchestrator is given
    ///      explicit human approvals.
    ///   3. This service ONLY modifies decisions that S5 already marked HUMAN_REVIEW_REQUIRED.
    ///   4. It NEVER changes a non-HR decision.
    ///   5. It requires every approval to have a non-empty ApprovedBy and Rationale.
    ///   6. It returns a HumanApprovalResult that records what was applied and why.
    ///   7. If ANY HR decision remains unresolved after applying approvals, the plan stays
    ///      HumanReviewRequired. The gate requires ALL HR decisions to be resolved.
    ///   8. The original S5 safety gate logic is never weakened.
    /// </summary>
    public class HumanApprovalService
    {
        /// <summary>
        /// Apply a set of human-approved resolutions to the plan.
        /// Returns a HumanApprovalResult describing what was applied.
        /// </summary>
        public HumanApprovalResult Apply(
            EngineeringPlan plan,
            IReadOnlyList<HumanApprovalRecord> approvals)
        {
            if (plan == null) throw new ArgumentNullException(nameof(plan));
            if (approvals == null || approvals.Count == 0)
                return HumanApprovalResult.NoApprovalsProvided();

            var result = new HumanApprovalResult
            {
                PlanId = plan.PlanId,
                TotalHRDecisionsBefore = plan.HumanReviewCount
            };

            // Validate all approvals have required fields
            foreach (var approval in approvals)
            {
                if (string.IsNullOrWhiteSpace(approval.ApprovedBy))
                {
                    result.Rejected.Add(new RejectedApproval
                    {
                        ActionIndex = approval.ActionIndex,
                        Reason = "ApprovedBy is required and cannot be empty."
                    });
                    continue;
                }

                if (string.IsNullOrWhiteSpace(approval.Rationale))
                {
                    result.Rejected.Add(new RejectedApproval
                    {
                        ActionIndex = approval.ActionIndex,
                        Reason = "Rationale is required and cannot be empty."
                    });
                    continue;
                }

                // Find the matching HR decision
                var decision = plan.Decisions.FirstOrDefault(d =>
                    d.ActionIndex == approval.ActionIndex &&
                    d.Decision == EngineeringDecisionType.HumanReviewRequired);

                if (decision == null)
                {
                    // Either action doesn't exist or it wasn't flagged as HR
                    var existing = plan.Decisions.FirstOrDefault(d => d.ActionIndex == approval.ActionIndex);
                    if (existing == null)
                    {
                        result.Rejected.Add(new RejectedApproval
                        {
                            ActionIndex = approval.ActionIndex,
                            Reason = $"Action index {approval.ActionIndex} not found in plan decisions."
                        });
                    }
                    else
                    {
                        result.Rejected.Add(new RejectedApproval
                        {
                            ActionIndex = approval.ActionIndex,
                            Reason = $"Action {approval.ActionIndex} was not flagged as HUMAN_REVIEW_REQUIRED " +
                                     $"(current decision: {existing.Decision}). " +
                                     "Human approvals only apply to HR-flagged decisions."
                        });
                    }
                    continue;
                }

                if (string.IsNullOrWhiteSpace(approval.ResolvedComponent))
                {
                    result.Rejected.Add(new RejectedApproval
                    {
                        ActionIndex = approval.ActionIndex,
                        Reason = "ResolvedComponent is required."
                    });
                    continue;
                }

                if (string.IsNullOrWhiteSpace(approval.ResolvedSourcePath))
                {
                    result.Rejected.Add(new RejectedApproval
                    {
                        ActionIndex = approval.ActionIndex,
                        Reason = "ResolvedSourcePath is required."
                    });
                    continue;
                }

                // Apply the approval — update the decision in-place
                var previousNote  = decision.HumanReviewNote;
                decision.Decision = approval.ResolvedDecisionType;
                decision.Component = approval.ResolvedComponent;
                decision.SourcePath = approval.ResolvedSourcePath;
                decision.ExistingComponentRef = approval.ResolvedComponent;
                decision.Reason = $"Human-approved ({approval.ApprovedBy}): {approval.Rationale}";
                decision.Confidence = 1.0;   // human-confirmed
                decision.HumanReviewNote = null;  // resolved — no longer pending HR

                result.Applied.Add(new AppliedApproval
                {
                    ActionIndex      = approval.ActionIndex,
                    ActionDescription = decision.ActionDescription,
                    ResolvedComponent = approval.ResolvedComponent,
                    ResolvedSourcePath = approval.ResolvedSourcePath,
                    ResolvedMethod   = approval.ResolvedMethod,
                    PreviousHRNote   = previousNote,
                    ApprovedBy       = approval.ApprovedBy,
                    ApprovedAt       = approval.ApprovedAt,
                    Rationale        = approval.Rationale
                });
            }

            result.TotalHRDecisionsAfter = plan.HumanReviewCount;

            // Only promote plan to Ready if ALL HR decisions are resolved
            if (result.Rejected.Count == 0 && plan.HumanReviewCount == 0)
            {
                plan.Status = PlanStatus.Ready;
                plan.HumanReviewReasons.Clear();
                plan.HumanReviewQuestions.Clear();
                result.PlanPromotedToReady = true;
            }
            else
            {
                result.PlanPromotedToReady = false;
                result.RemainingHRCount = plan.HumanReviewCount;
            }

            return result;
        }
    }

    // ===== Result models =====

    public class HumanApprovalResult
    {
        public string PlanId                { get; set; } = string.Empty;
        public int TotalHRDecisionsBefore   { get; set; }
        public int TotalHRDecisionsAfter    { get; set; }
        public int RemainingHRCount         { get; set; }
        public bool PlanPromotedToReady     { get; set; }
        public List<AppliedApproval> Applied   { get; set; } = new();
        public List<RejectedApproval> Rejected { get; set; } = new();

        public bool AllApproved => Rejected.Count == 0 && PlanPromotedToReady;

        public static HumanApprovalResult NoApprovalsProvided() =>
            new() { PlanPromotedToReady = false, RemainingHRCount = -1 };
    }

    public class AppliedApproval
    {
        public int    ActionIndex        { get; set; }
        public string ActionDescription  { get; set; } = string.Empty;
        public string ResolvedComponent  { get; set; } = string.Empty;
        public string ResolvedSourcePath { get; set; } = string.Empty;
        public string ResolvedMethod     { get; set; } = string.Empty;
        public string PreviousHRNote     { get; set; } = string.Empty;
        public string ApprovedBy         { get; set; } = string.Empty;
        public DateTime ApprovedAt       { get; set; }
        public string Rationale          { get; set; } = string.Empty;
    }

    public class RejectedApproval
    {
        public int    ActionIndex { get; set; }
        public string Reason      { get; set; } = string.Empty;
    }
}
