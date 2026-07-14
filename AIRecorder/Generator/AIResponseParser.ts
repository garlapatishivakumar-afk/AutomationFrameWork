import { AIResponse, ParsedAIResponse } from "./PromptModels";

export class AIResponseParser {

    public parse(
        response: AIResponse
    ): ParsedAIResponse {

        void response;

        return {
            methods: [],
            locators: [],
            steps: [],
            scenarios: [],
            helpers: []
        };

    }

}
