import { LLMConfiguration } from "./LLMConfiguration";
import { LLMRequest } from "./LLMRequest";
import { PromptPipeline, PromptPipelineInput } from "./PromptPipeline";
import {
    SimulatedStreamingLLMClient,
    StreamingLLMClient
} from "./StreamingLLMClient";
import { StreamingCallbacks } from "./StreamingCallbacks";
import { StreamingResult } from "./StreamingResult";
import { TokenAccumulator } from "./TokenAccumulator";

export interface StreamingGenerationInput extends PromptPipelineInput {

    configuration: LLMConfiguration;

    callbacks?: StreamingCallbacks;

}

export class StreamingGenerationOrchestrator {

    private readonly promptPipeline =
        new PromptPipeline();

    private readonly client: StreamingLLMClient;

    public constructor(
        client: StreamingLLMClient = new SimulatedStreamingLLMClient()
    ) {

        this.client = client;

    }

    public async run(
        input: StreamingGenerationInput
    ): Promise<StreamingResult> {

        const promptResult =
            this.promptPipeline.build(input);

        const accumulator =
            new TokenAccumulator();

        const callbacks: StreamingCallbacks = {
            onStarted: () => {
                input.callbacks?.onStarted?.();
            },
            onToken: (token: string) => {
                accumulator.append(token);
                input.callbacks?.onToken?.(token);
            },
            onCompleted: result => {
                input.callbacks?.onCompleted?.(result);
            },
            onError: error => {
                input.callbacks?.onError?.(error);
            }
        };

        const request: LLMRequest = {
            prompt: promptResult.prompt,
            model: input.configuration.model,
            temperature: input.configuration.temperature,
            maxTokens: input.configuration.maxTokens
        };

        const result =
            await this.client.stream(request, callbacks);

        const content =
            accumulator.build() || result.content;

        return {
            content,
            totalTokens: result.totalTokens,
            latencyMs: result.latencyMs,
            finishReason: result.finishReason
        };

    }

}
