import { ILLMClient } from "./ILLMClient";
import { LLMExecutionException } from "./LLMExecutionException";
import { LLMExecutionResult } from "./LLMExecutionResult";
import { LLMRequest } from "./LLMRequest";
import {
    DEFAULT_RETRY_POLICY,
    RetryPolicy
} from "./RetryPolicy";

export class OpenAIClient implements ILLMClient {

    private readonly retryPolicy: RetryPolicy;

    public constructor(
        retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY
    ) {

        this.retryPolicy = retryPolicy;

    }

    public async complete(request: LLMRequest): Promise<LLMExecutionResult> {

        let lastError: unknown;

        for (let attempt = 0; attempt <= this.retryPolicy.maxRetries; attempt++) {

            try {

                return await this.simulateApiCall(request);

            }
            catch (error) {

                lastError = error;

                if (attempt === this.retryPolicy.maxRetries)
                    break;

                await this.delay(this.retryPolicy.retryDelayMs);

            }

        }

        const message =
            lastError instanceof Error
                ? lastError.message
                : "Unknown LLM execution error";

        throw new LLMExecutionException(message);

    }

    private async simulateApiCall(
        request: LLMRequest
    ): Promise<LLMExecutionResult> {

        const startedAt =
            Date.now();

        const content =
            JSON.stringify({
                status: "simulated",
                promptSize: request.prompt.length,
                model: request.model,
                provider: "OpenAI"
            });

        const latencyMs =
            Date.now() - startedAt;

        const promptTokens =
            Math.ceil(request.prompt.length / 4);

        const completionTokens =
            Math.ceil(content.length / 4);

        return {
            success: true,
            content,
            model: request.model,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            latencyMs,
            finishReason: "stop"
        };

    }

    private async delay(ms: number): Promise<void> {

        await new Promise<void>(resolve => {
            setTimeout(resolve, ms);
        });

    }

}
