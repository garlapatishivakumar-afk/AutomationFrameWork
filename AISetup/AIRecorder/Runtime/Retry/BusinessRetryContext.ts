import { RetryPolicy } from "./RetryPolicy";

export interface BusinessRetryContext {

    statusName: string;

    expectedValue: string;

    policy: RetryPolicy;

    refreshBeforePoll: boolean;

}
