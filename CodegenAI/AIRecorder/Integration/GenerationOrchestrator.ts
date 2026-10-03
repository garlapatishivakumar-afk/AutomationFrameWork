import { LLMClientFactory } from "./LLMClientFactory";
import { LLMConfiguration } from "./LLMConfiguration";
import { LLMRequest } from "./LLMRequest";
import { PromptPipeline, PromptPipelineInput } from "./PromptPipeline";

export interface GenerationOrchestratorInput extends PromptPipelineInput {

    configuration: LLMConfiguration;

}

export interface GenerationOrchestratorResult {

    prompt: string;

    llmOutput: string;

    provider: string;

    model: string;

    promptTokens: number;

    completionTokens: number;

    totalTokens: number;

    latencyMs: number;

    finishReason: string;

}

export class GenerationOrchestrator {

    private readonly promptPipeline =
        new PromptPipeline();

    private readonly factory =
        new LLMClientFactory();

    public async run(
        input: GenerationOrchestratorInput
    ): Promise<GenerationOrchestratorResult> {

        const promptResult =
            this.promptPipeline.build(input);

        const client =
            this.factory.create(
                input.configuration.provider
            );

        const request: LLMRequest = {
            prompt: promptResult.prompt,
            model: input.configuration.model,
            temperature: input.configuration.temperature,
            maxTokens: input.configuration.maxTokens
        };

        try {

            const response =
                await client.complete(request);

            return {
                prompt: promptResult.prompt,
                llmOutput: response.content,
                provider: input.configuration.provider,
                model: response.model,
                promptTokens: response.promptTokens,
                completionTokens: response.completionTokens,
                totalTokens: response.totalTokens,
                latencyMs: response.latencyMs,
                finishReason: response.finishReason
            };

        }
        catch (error) {

            throw error;

        }

    }

}
