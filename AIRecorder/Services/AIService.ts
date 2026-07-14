import OpenAI from "openai";

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

		const response = await this.client.chat.completions.create({
			model: this.model,
			messages: [{ role: "user", content: prompt }],
			temperature: 0.1
		});

		return response.choices?.[0]?.message?.content ?? "";
	}
}

