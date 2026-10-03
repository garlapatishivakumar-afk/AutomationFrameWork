import { LLMExecutionResult } from "./LLMExecutionResult";
import { LLMRequest } from "./LLMRequest";
import { StreamingCallbacks } from "./StreamingCallbacks";

export interface StreamingLLMClient {

    stream(
        request: LLMRequest,
        callbacks: StreamingCallbacks
    ): Promise<LLMExecutionResult>;

}

export class SimulatedStreamingLLMClient implements StreamingLLMClient {

    private readonly failAtTokenIndex: number | null;

    public constructor(
        failAtTokenIndex: number | null = null
    ) {

        this.failAtTokenIndex = failAtTokenIndex;

    }

    public async stream(
        request: LLMRequest,
        callbacks: StreamingCallbacks
    ): Promise<LLMExecutionResult> {

        const startedAt =
            Date.now();

        const content =
            `Simulated streaming output for model ${request.model}.`;

        const tokens =
            content.split("");

        let assembled = "";

        callbacks.onStarted?.();

        try {

            for (let index = 0; index < tokens.length; index++) {

                if (this.failAtTokenIndex !== null && index === this.failAtTokenIndex)
                    throw new Error("Simulated streaming failure");

                const token =
                    tokens[index];

                assembled += token;

                callbacks.onToken?.(token);

                await this.delay(2);

            }

            const latencyMs =
                Date.now() - startedAt;

            const promptTokens =
                Math.ceil(request.prompt.length / 4);

            const completionTokens =
                Math.ceil(assembled.length / 4);

            const result: LLMExecutionResult = {
                success: true,
                content: assembled,
                model: request.model,
                promptTokens,
                completionTokens,
                totalTokens: promptTokens + completionTokens,
                latencyMs,
                finishReason: "stop"
            };

            callbacks.onCompleted?.(result);

            return result;

        }
        catch (error) {

            const err =
                error instanceof Error
                    ? error
                    : new Error(String(error));

            callbacks.onError?.(err);

            throw err;

        }

    }

    private async delay(ms: number): Promise<void> {

        await new Promise<void>(resolve => {
            setTimeout(resolve, ms);
        });

    }

}
