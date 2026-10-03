import { AIResponseParser } from "./AIResponseParser";
import { ContextBuilder } from "./ContextBuilder";
import { PromptBuilder } from "./PromptBuilder";
import { ParsedAIResponse, PromptRequest, PromptResult } from "./PromptModels";

export class GenerationEngine {

    private readonly contextBuilder =
        new ContextBuilder();

    private readonly promptBuilder =
        new PromptBuilder();

    private readonly responseParser =
        new AIResponseParser();

    public buildPrompt(
        templateName: string,
        featureName: string,
        pageName: string,
        application: string,
        objective: string,
        constraints: string[] = []
    ): PromptResult {

        const context = this.contextBuilder.build(
            featureName,
            pageName,
            application,
            objective,
            constraints
        );

        const request: PromptRequest = {
            templateName,
            context
        };

        return this.promptBuilder.build(request);

    }

    public parseResponse(
        raw: string
    ): ParsedAIResponse {

        return this.responseParser.parse({
            raw
        });

    }

}
