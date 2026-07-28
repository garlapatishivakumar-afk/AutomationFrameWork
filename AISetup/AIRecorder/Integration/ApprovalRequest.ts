import { ReviewResult } from "../Review/ReviewResult";

export interface ApprovalRequest {

    requestId: string;

    artifactNames: string[];

    review: ReviewResult;

    reviewScore: number;

    requestedBy: string;

    createdAt: string;

}
