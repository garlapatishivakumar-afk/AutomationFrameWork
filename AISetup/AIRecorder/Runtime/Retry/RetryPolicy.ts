export interface RetryPolicy {

    timeoutMs: number;

    intervalMs: number;

    maxAttempts?: number;

}

export const DefaultRetryPolicy: RetryPolicy = {
    timeoutMs: 5 * 60 * 1000,
    intervalMs: 30 * 1000
};
