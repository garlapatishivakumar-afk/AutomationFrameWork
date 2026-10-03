import { GenerationRequest } from "./Models/GenerationRequest";
import { GenerationResult } from "./Models/GenerationResult";
import { AIResponse } from "./Models/AIResponse";
import { ArtifactProcessor } from "./ArtifactProcessor";
import { DecisionEngine } from "./DecisionEngine";
import { buildFinalPrompt } from "./PromptBuilder";
import { OpenAIProvider } from "./Providers/OpenAIProvider";
import { parseAIResponse } from "./ResponseParser";
export class GenerationEngine {
 private provider = new OpenAIProvider();
 private artifactProcessor =
     new ArtifactProcessor();
 private decisionEngine =
     new DecisionEngine();
    constructor() {

    }

    public async generate(
        request: GenerationRequest
    ): Promise<GenerationResult> {

        const taskInstruction = request.taskInstruction || request.instruction || "";
        const explicitPages = request.explicitPages || request.pages || [];

        const decisionPlan = this.decisionEngine.buildPlan(
            taskInstruction,
            explicitPages,
            process.cwd()
        );

        const builtPrompt = buildFinalPrompt(
            taskInstruction,
            {
                explicitPages,
                decisionPlan
            }
        );

        const prompt = builtPrompt.prompt;

        const aiResponse = await this.provider.generate(prompt);

        const parsed: AIResponse =
            parseAIResponse(aiResponse);

        this.artifactProcessor.process(
            parsed.artifacts
        );

        return {

            success: true,

            prompt: builtPrompt.prompt,

            response: aiResponse,

            artifacts: parsed.artifacts,

            summary: parsed.summary,

            detectedPages: builtPrompt.detectedPages,

            includedFiles: builtPrompt.includedFiles,

            decisionPages: decisionPlan.pages,

            decisionRequested: decisionPlan.requested.length,

            decisionToGenerate: decisionPlan.toGenerate.length,

            decisionSkippedOrReused: decisionPlan.toReuseOrSkip.length

        };

    }

}
