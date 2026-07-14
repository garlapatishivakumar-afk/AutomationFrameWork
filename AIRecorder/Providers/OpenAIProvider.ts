import OpenAI from "openai";
import dotenv from "dotenv";
import type { AIProvider } from "./AIProvider";

dotenv.config();

export class OpenAIProvider implements AIProvider {

    private client = new OpenAI({

        apiKey: process.env.OPENAI_API_KEY

    });

    public async generate(
        prompt: string
    ): Promise<string> {

        const response =
            await this.client.responses.create({

                model: process.env.OPENAI_MODEL || "gpt-5.5",

                input: prompt

            });

        return response.output_text ?? "";

    }

}