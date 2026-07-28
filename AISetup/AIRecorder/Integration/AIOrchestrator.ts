import { FrameworkIntelligenceEngine } from "../Intelligence/FrameworkIntelligenceEngine";
import { IntelligenceResult } from "../Intelligence/FrameworkIntelligenceEngine";
import { PlannerContext } from "../Planner/PlannerContext";
import { PlanningEngine } from "../Planner/PlanningEngine";
import { PlanningResult } from "../Planner/PlannerModels";
import { AIExecutionContext } from "./AIExecutionContext";
import { AIExecutionResult, PipelineStatus } from "./AIExecutionResult";
import { FeedbackResult } from "./FeedbackResult";
import { GenerationResult } from "./GenerationResult";
import { GenerationPipeline } from "./GenerationPipeline";
import { KnowledgeFeedbackEngine } from "./KnowledgeFeedbackEngine";

export class AIOrchestrator {

    private readonly planner =
        new PlanningEngine();

    private readonly intelligence =
        new FrameworkIntelligenceEngine();

    private readonly generation =
        new GenerationPipeline();

    private readonly feedback =
        new KnowledgeFeedbackEngine();

    public async execute(context: AIExecutionContext): Promise<AIExecutionResult> {

        const start =
            Date.now();

        const startedAt =
            new Date(start).toISOString();

        const executionId =
            this.createExecutionId(context.requestId, start);

        let status: PipelineStatus =
            "Planning";

        let planning: PlanningResult | null = null;
        let intelligence: IntelligenceResult | null = null;
        let generation: GenerationResult | null = null;
        let feedback: FeedbackResult | null = null;

        try {

            try {

                planning =
                    this.planner.plan(context.plannerContext);

            }
            catch (error) {

                return this.failedResult(
                    status,
                    executionId,
                    startedAt,
                    start,
                    planning,
                    intelligence,
                    generation,
                    feedback,
                    error,
                    context.requestId
                );

            }

            status = "Learning";

            try {

                intelligence =
                    this.intelligence.scanAndAnalyze(context.projectRoot);

            }
            catch (error) {

                return this.failedResult(
                    status,
                    executionId,
                    startedAt,
                    start,
                    planning,
                    intelligence,
                    generation,
                    feedback,
                    error,
                    context.requestId
                );

            }

            status = "Generating";

            try {

                generation =
                    await this.generation.run({
                        planning,
                        objective: context.objective,
                        query: context.query,
                        templateName: context.templateName,
                        featureName: context.plannerContext.featureName,
                        pageName: context.plannerContext.pageName,
                        application: context.plannerContext.application,
                        constraints: context.constraints
                    });

            }
            catch (error) {

                return this.failedResult(
                    status,
                    executionId,
                    startedAt,
                    start,
                    planning,
                    intelligence,
                    generation,
                    feedback,
                    error,
                    context.requestId
                );

            }

            status = "Reviewing";

            try {

                feedback =
                    this.feedback.process(
                        generation.llmOutput,
                        generation.review.findings.map(x => x.message)
                    );

            }
            catch (error) {

                return this.failedResult(
                    status,
                    executionId,
                    startedAt,
                    start,
                    planning,
                    intelligence,
                    generation,
                    feedback,
                    error,
                    context.requestId
                );

            }

            status = "Completed";

            const completedAtMs =
                Date.now();

            return {
                success: true,
                status,
                executionId,
                startedAt,
                completedAt: new Date(completedAtMs).toISOString(),
                executionTimeMs: completedAtMs - start,
                planning,
                intelligence,
                generation,
                feedback,
                notes: [
                    `requestId=${context.requestId}`,
                    `plannerActions=${planning.actions.length}`,
                    `generated=${generation.generationSummary.totalGenerated}`
                ]
            };

        }
        catch (error) {

            return this.failedResult(
                status,
                executionId,
                startedAt,
                start,
                planning,
                intelligence,
                generation,
                feedback,
                error,
                context.requestId
            );

        }

    }

    private failedResult(
        failedAt: PipelineStatus,
        executionId: string,
        startedAt: string,
        startedAtMs: number,
        planning: PlanningResult | null,
        intelligence: IntelligenceResult | null,
        generation: GenerationResult | null,
        feedback: FeedbackResult | null,
        error: unknown,
        requestId: string
    ): AIExecutionResult {

        const completedAtMs =
            Date.now();

        return {
            success: false,
            status: "Failed",
            executionId,
            startedAt,
            completedAt: new Date(completedAtMs).toISOString(),
            executionTimeMs: completedAtMs - startedAtMs,
            planning,
            intelligence,
            generation,
            feedback,
            notes: [
                `requestId=${requestId}`,
                `failedAt=${failedAt}`,
                `error=${this.toErrorMessage(error)}`
            ]
        };

    }

    private toErrorMessage(error: unknown): string {

        if (error instanceof Error)
            return error.message;

        return String(error);

    }

    private createExecutionId(
        requestId: string,
        startedAtMs: number
    ): string {

        const random =
            Math.floor(Math.random() * 100000)
                .toString()
                .padStart(5, "0");

        return `${requestId}-${startedAtMs}-${random}`;

    }

    public static createPlannerContext(
        projectRoot: string,
        objective: string,
        featureName: string,
        pageName: string,
        application: string
    ): PlannerContext {

        return {
            projectRoot,
            detectedPages: [pageName],
            requiredMethods: [objective],
            requiredLocators: [],
            requiredSteps: [],
            requiredScenarios: [],
            requiredHelpers: [],
            createExcel: false,
            featureName,
            pageName,
            application
        };

    }

}
