import { ApprovalDecision } from "./ApprovalDecision";

export interface ApprovalResult {

    decision: ApprovalDecision;

    approved: boolean;

    reason: string;

    reviewedBy: string;

    reviewedAt: string;

    comments?: string;

}
