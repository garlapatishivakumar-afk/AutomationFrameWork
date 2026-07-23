import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

type TokenUsageRecord = {
    timestamp: string;
    operation: string;
    model: string;
    provider: "openai";
    endpoint: "responses" | "chat.completions";
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    promptCharacters?: number;
    responseId?: string;
    latencyMs?: number;
};

type ResponseUsage = {
    input_tokens?: number | null;
    output_tokens?: number | null;
    total_tokens?: number | null;
};

type ChatUsage = {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
};

export class TokenUsageLogger {

    private static readonly logPath =
        process.env.TOKEN_USAGE_LOG_PATH ||
        path.join(process.cwd(), "AIRecorder", "Logs", "token-usage.jsonl");

    public static async logResponsesUsage(input: {
        operation: string;
        model: string;
        usage?: ResponseUsage;
        promptCharacters?: number;
        responseId?: string;
        latencyMs?: number;
    }): Promise<void> {

        const usage = input.usage;

        await this.write({
            timestamp: new Date().toISOString(),
            operation: input.operation,
            model: input.model,
            provider: "openai",
            endpoint: "responses",
            inputTokens: Number(usage?.input_tokens ?? 0),
            outputTokens: Number(usage?.output_tokens ?? 0),
            totalTokens: Number(usage?.total_tokens ?? 0),
            promptCharacters: input.promptCharacters,
            responseId: input.responseId,
            latencyMs: input.latencyMs
        });

    }

    public static async logChatUsage(input: {
        operation: string;
        model: string;
        usage?: ChatUsage;
        promptCharacters?: number;
        responseId?: string;
        latencyMs?: number;
    }): Promise<void> {

        const usage = input.usage;

        await this.write({
            timestamp: new Date().toISOString(),
            operation: input.operation,
            model: input.model,
            provider: "openai",
            endpoint: "chat.completions",
            inputTokens: Number(usage?.prompt_tokens ?? 0),
            outputTokens: Number(usage?.completion_tokens ?? 0),
            totalTokens: Number(usage?.total_tokens ?? 0),
            promptCharacters: input.promptCharacters,
            responseId: input.responseId,
            latencyMs: input.latencyMs
        });

    }

    private static async write(record: TokenUsageRecord): Promise<void> {

        try {

            const folder = path.dirname(this.logPath);
            await mkdir(folder, { recursive: true });

            const line = `${JSON.stringify(record)}\n`;
            await appendFile(this.logPath, line, { encoding: "utf8" });

        }
        catch (error) {

            const message =
                error instanceof Error
                    ? error.message
                    : String(error);

            console.warn("[TokenUsageLogger] Failed to write token usage:", message);

        }

    }

}