export interface LLMConfiguration {

    provider:
        "OpenAI"
        | "AzureOpenAI"
        | "Claude"
        | "Gemini";

    model: string;

    temperature: number;

    maxTokens: number;

}
