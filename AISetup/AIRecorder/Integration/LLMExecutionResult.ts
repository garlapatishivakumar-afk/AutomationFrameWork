export interface LLMExecutionResult {

    success: boolean;

    content: string;

    model: string;

    promptTokens: number;

    completionTokens: number;

    totalTokens: number;

    latencyMs: number;

    finishReason: string;

    error?: string;

}
