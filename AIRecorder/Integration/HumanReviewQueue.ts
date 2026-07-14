import { ApprovalRequest } from "./ApprovalRequest";

export type QueueStatus =
    | "Pending"
    | "Approved"
    | "Rejected"
    | "Expired";

export interface QueueItem {

    request: ApprovalRequest;

    status: QueueStatus;

}

export class HumanReviewQueue {

    private readonly items: QueueItem[] = [];

    public enqueue(request: ApprovalRequest): void {

        this.items.push({
            request,
            status: "Pending"
        });

    }

    public update(
        requestId: string,
        status: QueueStatus
    ): void {

        const item =
            this.items.find(x => x.request.requestId === requestId);

        if (item)
            item.status = status;

    }

    public pending(): QueueItem[] {

        return this.items.filter(x => x.status === "Pending");

    }

    public all(): QueueItem[] {

        return [...this.items];

    }

}
