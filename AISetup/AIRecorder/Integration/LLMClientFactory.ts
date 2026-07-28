import { ILLMClient } from "./ILLMClient";
import { OpenAIClient } from "./OpenAIClient";

export class LLMClientFactory {

    public create(
        provider: string
    ): ILLMClient {

        switch (provider) {

            case "OpenAI":
                return new OpenAIClient();

            case "AzureOpenAI":
                return new OpenAIClient();

            case "Claude":
                return new OpenAIClient();

            case "Gemini":
                return new OpenAIClient();

            default:
                return new OpenAIClient();

        }

    }

}
