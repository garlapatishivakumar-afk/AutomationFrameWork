import OpenAI from "openai";
import { TokenUsageLogger } from "./TokenUsageLogger";

export class AIService {

	private readonly client: OpenAI;

	private readonly model: string;

	constructor(
		apiKey: string = process.env.OPENAI_API_KEY || "",
		model: string = process.env.OPENAI_MODEL || "gpt-4o-mini"
	) {

		if (!apiKey) {
			throw new Error("OPENAI_API_KEY is not configured.");
		}

		this.client = new OpenAI({ apiKey });
		this.model = model;
	}

	async generate(prompt: string): Promise<string> {

		const startedAt = Date.now();

		const response = await this.client.chat.completions.create({
			model: this.model,
			messages: [{ role: "user", content: prompt }],
			temperature: 0.1
		});

		await TokenUsageLogger.logChatUsage({
			operation: "AIService.generate",
			model: this.model,
			usage: response.usage,
			promptCharacters: prompt.length,
			responseId: response.id,
			latencyMs: Date.now() - startedAt
		});

		return response.choices?.[0]?.message?.content ?? "";
	}
}

