import OpenAI from "openai";
import dotenv from "dotenv";
import type { AIProvider } from "./AIProvider";
import { TokenUsageLogger } from "../Services/TokenUsageLogger";

dotenv.config();

export class OpenAIProvider implements AIProvider {

    private client = new OpenAI({

        apiKey: process.env.OPENAI_API_KEY

    });

    public async generate(
        prompt: string
    ): Promise<string> {

        const model = process.env.OPENAI_MODEL || "gpt-5.5";
        const startedAt = Date.now();

        const response =
            await this.client.responses.create({

                model,

                input: prompt

            });

        await TokenUsageLogger.logResponsesUsage({
            operation: "OpenAIProvider.generate",
            model,
            usage: response.usage,
            promptCharacters: prompt.length,
            responseId: response.id,
            latencyMs: Date.now() - startedAt
        });

        return response.output_text ?? "";

    }

}