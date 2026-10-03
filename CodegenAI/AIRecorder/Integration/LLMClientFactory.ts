import { ILLMClient } from "./ILLMClient";
import { OpenAIClient } from "./OpenAIClient";

export class LLMClientFactory {

    public create(
        provider: string
    ): ILLMClient {

        switch (provider) {

            case "OpenAI":
                return new OpenAIClient(provider);

            case "AzureOpenAI":
                return new OpenAIClient(provider);

            case "Claude":
                return new OpenAIClient(provider);

            case "Gemini":
                return new OpenAIClient(provider);

            default:
                return new OpenAIClient(provider);

        }

    }

}
