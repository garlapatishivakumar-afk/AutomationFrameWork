export type ApprovalMode =
    | "AutoApprove"
    | "Manual"
    | "CriticalOnly"
    | "NeverAutoApprove";

export interface ApprovalPolicy {

    mode: ApprovalMode;

    minimumReviewScoreForAutoApprove: number;

}

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
    mode: "CriticalOnly",
    minimumReviewScoreForAutoApprove: 80
};
