import { LearningEntry } from "../Learning/LearningModels";
import { LearningPipeline } from "../Learning/LearningPipeline";
import { RAGEngine } from "../Learning/RAGEngine";
import { PlanningResult } from "../Planner/PlannerModels";
import { AutoFixEngine } from "../Review/AutoFixEngine";
import { ArtifactGenerationPlan } from "./ArtifactGenerationPlan";
import { ApprovalEngine } from "./ApprovalEngine";
import { ApprovalRequest } from "./ApprovalRequest";
import { CodeReviewer } from "../Review/CodeReviewer";
import { GenerationOrchestrator } from "./GenerationOrchestrator";
import { GenerationResult } from "./GenerationResult";
import { MultiArtifactGenerator } from "./MultiArtifactGenerator";
import { WorkflowContext } from "./WorkflowContext";
import { WorkflowEngine } from "./WorkflowEngine";
import { WorkflowStep } from "./WorkflowStep";
import { ReviewResult } from "../Review/ReviewResult";

export interface GenerationPipelineInput {

    planning: PlanningResult;

    objective: string;

    query: string;

    templateName: string;

    featureName: string;

    pageName: string;

    application: string;

    constraints: string[];

}

export class GenerationPipeline {

    private readonly learning =
        new LearningPipeline();

    private readonly rag =
        new RAGEngine();

    private readonly generationOrchestrator =
        new GenerationOrchestrator();

    private readonly multiArtifactGenerator =
        new MultiArtifactGenerator();

    private readonly workflowEngine =
        new WorkflowEngine();

    private readonly approvalEngine =
        new ApprovalEngine();

    private readonly reviewer =
        new CodeReviewer();

    private readonly autoFix =
        new AutoFixEngine();

    public async run(input: GenerationPipelineInput): Promise<GenerationResult> {

        const context: WorkflowContext = {
            input,
            recommendations: [],
            retrievedCount: 0,
            prompt: "",
            llmOutput: "",
            generationOutput: null,
            review: null,
            fixes: [],
            plan: this.buildGenerationPlan(input),
            approval: null,
            generated: null,
            errors: []
        };

        const workflow =
            await this.workflowEngine.execute(
                context,
                this.buildWorkflowSteps()
            );

        const review =
            context.review ?? {
                passed: true,
                findings: [],
                suggestions: []
            };

        const summary =
            context.generated?.summary ?? {
                totalRequested: 0,
                totalGenerated: 0,
                totalValidated: 0,
                totalIntegrated: 0,
                notes: context.errors
            };

        return {
            prompt: context.prompt,
            llmOutput: context.llmOutput,
            recommendations: context.recommendations,
            generationSummary: summary,
            review,
            fixes: context.fixes,
            workflow,
            approval: context.approval
        };

    }

    private buildWorkflowSteps(): WorkflowStep[] {

        return [
            {
                stage: "Planning",
                execute: async context => {
                    context.plan =
                        this.buildGenerationPlan(context.input);
                }
            },
            {
                stage: "KnowledgeRetrieval",
                execute: async context => {
                    const entries =
                        this.buildLearningEntries(context.input.planning);

                    context.recommendations =
                        this.learning.run(entries, context.input.query);

                    const retrieved =
                        this.rag.retrieve(
                            this.learning.getLearningEngine().getKnowledgeBase(),
                            context.input.query
                        );

                    context.retrievedCount =
                        retrieved.length;
                }
            },
            {
                stage: "PromptBuild",
                execute: async () => {
                    // Prompt is built in LLM stage via GenerationOrchestrator.
                }
            },
            {
                stage: "LLM",
                execute: async context => {
                    context.generationOutput =
                        await this.generationOrchestrator.run({
                            templateName: context.input.templateName,
                            featureName: context.input.featureName,
                            pageName: context.input.pageName,
                            application: context.input.application,
                            objective: context.input.objective,
                            constraints: context.input.constraints,
                            retrievedCount: context.retrievedCount,
                            configuration: {
                                provider: "OpenAI",
                                model: "gpt-5.3-codex",
                                temperature: 0.2,
                                maxTokens: 2000
                            }
                        });

                    context.prompt =
                        context.generationOutput.prompt;

                    context.llmOutput =
                        context.generationOutput.llmOutput;
                }
            },
            {
                stage: "Review",
                execute: async context => {
                    context.review =
                        this.reviewer.reviewContent(context.llmOutput);
                }
            },
            {
                stage: "AutoFix",
                execute: async context => {
                    if (!context.review)
                        throw new Error("Review must run before AutoFix");

                    context.fixes =
                        this.autoFix
                            .suggest(context.review)
                            .map(x => x.message);
                }
            },
            {
                stage: "Approval",
                execute: async context => {
                    if (!context.review)
                        throw new Error("Review must run before Approval");

                    const request: ApprovalRequest = {
                        requestId: `${context.input.featureName}-${Date.now()}`,
                        artifactNames: [
                            context.plan.feature,
                            ...context.plan.steps,
                            context.plan.page,
                            ...context.plan.locators
                        ],
                        review: context.review,
                        reviewScore: this.calculateReviewScore(context.review),
                        requestedBy: "WorkflowEngine",
                        createdAt: new Date().toISOString()
                    };

                    context.approval =
                        this.approvalEngine.evaluate(request);

                    if (!context.approval.approved)
                        throw new Error(`Approval blocked: ${context.approval.reason}`);
                }
            },
            {
                stage: "ArtifactGeneration",
                execute: async context => {
                    if (!context.generationOutput)
                        throw new Error("LLM stage must run before ArtifactGeneration");

                    context.generated =
                        this.multiArtifactGenerator.generate({
                            request: context.input.objective,
                            projectRoot: ".",
                            prompt: context.prompt,
                            llmResult: context.llmOutput,
                            provider: context.generationOutput.provider,
                            model: context.generationOutput.model,
                            totalTokens: context.generationOutput.totalTokens,
                            latencyMs: context.generationOutput.latencyMs,
                            plan: context.plan
                        });
                }
            },
            {
                stage: "WriteFiles",
                execute: async context => {
                    if (!context.generated)
                        throw new Error("Artifact generation must run before WriteFiles");
                }
            },
            {
                stage: "History",
                execute: async context => {
                    if (!context.generated)
                        throw new Error("Artifact generation must run before History");
                }
            },
            {
                stage: "Done",
                execute: async () => {
                    // End marker stage.
                }
            }
        ];

    }

    private buildLearningEntries(planning: PlanningResult): LearningEntry[] {

        const now =
            new Date().toISOString();

        return planning.actions.map((action, index) => ({
            key: `${action.artifactType}_${action.name}_${index}`,
            value: `${action.reason} -> ${action.filePath}`,
            source: action.artifactType,
            score: 1,
            usageCount: 1,
            lastUsed: now
        }));

    }

    private buildGenerationPlan(
        input: GenerationPipelineInput
    ): ArtifactGenerationPlan {

        const actions =
            input.planning.actions;

        const steps =
            actions
                .filter(action => action.artifactType === "Step")
                .map(action => action.name);

        const locators =
            actions
                .filter(action => action.artifactType === "Locator")
                .map(action => action.name);

        const excel =
            actions
                .filter(action => action.artifactType === "Excel")
                .map(action => action.name);

        const helpers =
            actions
                .filter(action => action.artifactType === "Helper")
                .map(action => action.name);

        return {
            feature: input.featureName,
            steps: steps.length > 0 ? steps : [`${input.featureName}Steps`],
            page: input.pageName,
            locators: locators.length > 0 ? locators : [`${input.pageName}Locators`],
            excel,
            helpers,
            config: ["playwright.config.ts"],
            tests: [`${input.featureName}Tests`]
        };

    }

    private calculateReviewScore(
        review: ReviewResult
    ): number {

        const high =
            review.findings.filter(x => x.severity === "High").length;

        const medium =
            review.findings.filter(x => x.severity === "Medium").length;

        const low =
            review.findings.filter(x => x.severity === "Low").length;

        const score =
            100 - (high * 30) - (medium * 15) - (low * 5);

        return Math.max(0, Math.min(100, score));

    }

}
