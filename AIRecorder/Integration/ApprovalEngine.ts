import { ApprovalDecision } from "./ApprovalDecision";
import { ApprovalHistory } from "./ApprovalHistory";
import { ApprovalPolicy, DEFAULT_APPROVAL_POLICY } from "./ApprovalPolicy";
import { ApprovalRequest } from "./ApprovalRequest";
import { ApprovalResult } from "./ApprovalResult";
import { HumanReviewQueue } from "./HumanReviewQueue";

export class ApprovalEngine {

    private readonly policy: ApprovalPolicy;

    private readonly history =
        new ApprovalHistory();

    private readonly queue =
        new HumanReviewQueue();

    public constructor(
        policy: ApprovalPolicy = DEFAULT_APPROVAL_POLICY
    ) {

        this.policy = policy;

    }

    public evaluate(request: ApprovalRequest): ApprovalResult {

        const decision =
            this.decide(request);

        const result: ApprovalResult = {
            decision,
            approved: decision === "Approved",
            reason: this.reason(decision, request),
            reviewedBy: decision === "Approved" ? "ApprovalEngine" : "HumanReviewer",
            reviewedAt: new Date().toISOString()
        };

        if (decision === "Pending")
            this.queue.enqueue(request);

        if (decision === "Approved")
            this.queue.update(request.requestId, "Approved");

        if (decision === "Rejected")
            this.queue.update(request.requestId, "Rejected");

        this.history.add(request, result);

        return result;

    }

    public getHistory(): ApprovalHistory {

        return this.history;

    }

    public getQueue(): HumanReviewQueue {

        return this.queue;

    }

    private decide(request: ApprovalRequest): ApprovalDecision {

        switch (this.policy.mode) {
            case "AutoApprove":
                return "Approved";

            case "NeverAutoApprove":
                return "Pending";

            case "Manual":
                return "Pending";

            case "CriticalOnly": {

                const hasCritical =
                    request.review.findings.some(x => x.severity === "High");

                if (hasCritical)
                    return "Pending";

                if (request.reviewScore < this.policy.minimumReviewScoreForAutoApprove)
                    return "Pending";

                return "Approved";

            }

            default:
                return "Pending";
        }

    }

    private reason(
        decision: ApprovalDecision,
        request: ApprovalRequest
    ): string {

        switch (decision) {
            case "Approved":
                return `Auto approved with reviewScore=${request.reviewScore}`;

            case "Rejected":
                return "Rejected by approval policy";

            case "Pending":
                return "Human approval required";

            default:
                return "Approval undecided";
        }

    }

}
