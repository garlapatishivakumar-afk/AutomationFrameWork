import { GenerationEngine as PromptGenerationEngine } from "../Generator/GenerationEngine";

export interface PromptPipelineInput {

    templateName: string;

    featureName: string;

    pageName: string;

    application: string;

    objective: string;

    constraints: string[];

    retrievedCount: number;

}

export interface PromptPipelineResult {

    prompt: string;

}

export class PromptPipeline {

    private readonly promptEngine =
        new PromptGenerationEngine();

    public build(input: PromptPipelineInput): PromptPipelineResult {

        const promptResult =
            this.promptEngine.buildPrompt(
                input.templateName,
                input.featureName,
                input.pageName,
                input.application,
                input.objective,
                input.constraints
            );

        return {
            prompt: `${promptResult.prompt}\n\nRetrieved Knowledge Entries: ${input.retrievedCount}`
        };

    }

}
