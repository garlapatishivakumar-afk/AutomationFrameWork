import { ApprovalRequest } from "./ApprovalRequest";
import { ApprovalResult } from "./ApprovalResult";

export interface ApprovalHistoryEntry {

    request: ApprovalRequest;

    result: ApprovalResult;

}

export class ApprovalHistory {

    private readonly entries: ApprovalHistoryEntry[] = [];

    public add(
        request: ApprovalRequest,
        result: ApprovalResult
    ): void {

        this.entries.push({
            request,
            result
        });

    }

    public all(): ApprovalHistoryEntry[] {

        return [...this.entries];

    }

    public latest(): ApprovalHistoryEntry | null {

        return this.entries[this.entries.length - 1] ?? null;

    }

}
