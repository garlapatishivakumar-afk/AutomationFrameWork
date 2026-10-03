import { ILLMClient } from "./ILLMClient";
import { LLMExecutionException } from "./LLMExecutionException";
import { LLMExecutionResult } from "./LLMExecutionResult";
import { LLMRequest } from "./LLMRequest";
import {
    DEFAULT_RETRY_POLICY,
    RetryPolicy
} from "./RetryPolicy";
import { completeLLMRequest } from "./OpenAIClientCore.cjs";

export class OpenAIClient implements ILLMClient {

    private readonly retryPolicy: RetryPolicy;

    private readonly provider: string;

    public constructor(
        provider: string = "OpenAI",
        retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY
    ) {

        this.provider = provider;
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

        const response = await completeLLMRequest(
            request,
            {
                provider: this.provider,
                model: request.model,
                temperature: request.temperature,
                maxTokens: request.maxTokens
            }
        );

        if (!response.available || !response.result) {
            throw new Error(response.reason || "LLM provider is unavailable.");
        }

        return response.result;

    }

    private async delay(ms: number): Promise<void> {

        await new Promise<void>(resolve => {
            setTimeout(resolve, ms);
        });

    }

}
