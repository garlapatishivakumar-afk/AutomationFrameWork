export interface LLMResponse {

    content: string;

    model: string;

    promptTokens: number;

    completionTokens: number;

    totalTokens: number;

    latencyMs: number;

}
