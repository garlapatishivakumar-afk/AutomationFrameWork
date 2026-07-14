import { buildPromptContext, BuiltContext } from "./ContextBuilder";
import { DecisionEngine } from "./Decision/DecisionEngine";
import { GenerationDecision } from "./Decision/DecisionModels";
import { analyzeFlow, FlowAnalysis } from "./FlowAnalyzer";
import { buildFinalPrompt } from "./PromptBuilder";

export class AIOrchestrator {

    private decisionEngine =
        new DecisionEngine();

    public async execute() {

        try {

            console.log("Analyzing flow...");
            const flow =
                this.analyzeFlow();

            console.log("Building context...");
            const context =
                this.buildContext(flow);

            console.log("Running local search...");
            this.runLocalSearch(context);

            console.log("Running decision engine...");
            const decision =
                this.decide(context);

            console.log("Generating prompt...");
            const prompt =
                this.buildPrompt(context, decision);

            console.log("Calling AI...");
            const aiResponse =
                await this.callOpenAI(prompt);

            console.log("Parsing response...");
            const artifacts =
                this.parse(aiResponse);

            console.log("Detecting duplicates...");
            const uniqueArtifacts =
                this.removeDuplicates(artifacts);

            console.log("Validating...");
            this.validate(uniqueArtifacts);

            console.log("Updating framework...");
            this.applyChanges(uniqueArtifacts);

            console.log("Done.");

        } catch (error) {

            console.error(error);

        }

    }

    private analyzeFlow(): FlowAnalysis {

        return analyzeFlow();

    }

    private buildContext(flow: FlowAnalysis): BuiltContext {

        const context = buildPromptContext();

        return {
            ...context,
            flow
        };

    }

    private runLocalSearch(context: unknown) {

        void context;
        // TODO: integrate LocalSearch

    }

    private decide(context: BuiltContext): GenerationDecision {

        return this.decisionEngine.decide(context);

    }

    private buildPrompt(
        context: BuiltContext,
        decision: GenerationDecision
    ): string {

        void decision;

        return buildFinalPrompt(
            "Generate only required missing framework artifacts.",
            {
                explicitPages: context.detectedPages
            }
        ).prompt;

    }

    private async callOpenAI(prompt: string) {

        void prompt;
        // TODO: integrate OpenAIProvider
        return "";

    }

    private parse(aiResponse: string) {

        void aiResponse;
        // TODO: integrate ResponseParser
        return [] as unknown[];

    }

    private removeDuplicates(artifacts: unknown[]) {

        // TODO: integrate DuplicateDetector
        return artifacts;

    }

    private validate(artifacts: unknown[]) {

        void artifacts;
        // TODO: integrate OutputValidator

    }

    private applyChanges(artifacts: unknown[]) {

        void artifacts;
        // TODO: integrate FrameworkEditor
    }

}

