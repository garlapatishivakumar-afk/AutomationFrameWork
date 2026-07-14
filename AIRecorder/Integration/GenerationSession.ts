export interface GenerationSession {

    request: string;

    prompt: string;

    llmResult: string;

    files: string[];

    metrics: {
        provider: string;
        model: string;
        totalTokens: number;
        latencyMs: number;
    };

    errors: string[];

    createdAt: string;

}
