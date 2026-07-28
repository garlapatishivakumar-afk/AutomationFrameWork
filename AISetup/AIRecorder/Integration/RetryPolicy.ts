export interface RetryPolicy {

    maxRetries: number;

    retryDelayMs: number;

}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
    maxRetries: 3,
    retryDelayMs: 1000
};
