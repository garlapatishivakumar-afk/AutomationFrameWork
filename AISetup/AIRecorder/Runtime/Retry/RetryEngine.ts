import { DefaultRetryPolicy, RetryPolicy } from "./RetryPolicy";

export class RetryEngine {

    public async waitUntilAsync(
        probe: () => Promise<string>,
        expectedValue: string,
        policy: RetryPolicy = DefaultRetryPolicy
    ): Promise<string> {

        const startedAt = Date.now();
        let attempts = 0;
        let last = "";

        while (Date.now() - startedAt <= policy.timeoutMs) {
            attempts += 1;
            last = (await probe()).trim();

            if (last.toLowerCase() === expectedValue.toLowerCase())
                return last;

            if (policy.maxAttempts && attempts >= policy.maxAttempts)
                break;

            await new Promise<void>(resolve => setTimeout(resolve, policy.intervalMs));
        }

        throw new Error(`Retry timeout. Expected '${expectedValue}', but last value was '${last}'.`);

    }

}
