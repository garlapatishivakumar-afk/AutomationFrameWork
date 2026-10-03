import dotenv from "dotenv";
import type { AIProvider } from "./AIProvider";
import { completeLLMRequest } from "../Integration/OpenAIClientCore.cjs";

dotenv.config();

export class OpenAIProvider implements AIProvider {

    public async generate(
        prompt: string
    ): Promise<string> {

        const response = await completeLLMRequest(
            {
                prompt,
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                temperature: 0.1,
                maxTokens: 1200
            },
            {
                provider: "OpenAI",
                model: process.env.OPENAI_MODEL || "gpt-4o-mini",
                temperature: 0.1,
                maxTokens: 1200
            }
        );

        if (!response.available || !response.result) {
            throw new Error(response.reason || "OpenAI provider is unavailable.");
        }

        return response.result.content ?? "";

    }

}