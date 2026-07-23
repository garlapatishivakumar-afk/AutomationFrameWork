import { LearningEntry } from "../Learning/LearningModels";
import { LearningPipeline } from "../Learning/LearningPipeline";
import { RAGEngine } from "../Learning/RAGEngine";
import { PlanningResult } from "../Planner/PlannerModels";
import { QuestionEngine } from "../Runtime/Questions/QuestionEngine";
import { RuntimeVariable } from "../Runtime/Variables/RuntimeVariable";
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
import fs from "fs";
import path from "path";

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

    private readonly questionEngine =
        new QuestionEngine();

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
            interactiveQuestions: [],
            questionFindings: [],
            runtimeVariables: [],
            businessRetryRules: [],
            validationTargets: [],
            phase9Constraints: [],
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
            approval: context.approval,
            phase9: {
                interactiveQuestions: context.interactiveQuestions.map(x => x.text),
                runtimeVariables: context.runtimeVariables.map(x => x.name),
                businessRetryRules: context.businessRetryRules,
                validationTargets: context.validationTargets
            }
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
                stage: "InteractiveQuestions",
                execute: async context => {
                    const result =
                        this.questionEngine.analyzeCodeFile(process.cwd());

                    context.interactiveQuestions =
                        result.session.questions;

                    context.questionFindings = [
                        result.findings.statusField ? `Detected status field: ${result.findings.statusField}` : "No status field detected",
                        result.findings.hasCapture ? "Capture opportunities detected" : "No capture opportunities detected",
                        result.findings.hasValidation ? "Validation opportunities detected" : "No validation opportunities detected"
                    ];
                }
            },
            {
                stage: "VariableCapture",
                execute: async context => {
                    context.runtimeVariables =
                        this.detectRuntimeVariables();
                }
            },
            {
                stage: "BusinessRetry",
                execute: async context => {
                    const hasStatusQuestion =
                        context.interactiveQuestions.some(x => x.type === "status-change");

                    context.businessRetryRules = hasStatusQuestion
                        ? [
                            "Pending -> Completed",
                            "Running -> Success",
                            "Processing -> Approved",
                            "Submitted -> Completed",
                            "Failed -> Retry"
                        ]
                        : [];
                }
            },
            {
                stage: "ValidationPlanning",
                execute: async context => {
                    const validationQuestion =
                        context.interactiveQuestions.find(x => x.type === "validation");

                    context.validationTargets =
                        validationQuestion?.options ?? [];
                }
            },
            {
                stage: "PromptBuild",
                execute: async context => {
                    context.phase9Constraints =
                        this.buildPhase9Constraints(context.input.constraints, {
                            findings: context.questionFindings,
                            variables: context.runtimeVariables,
                            retryRules: context.businessRetryRules,
                            validations: context.validationTargets
                        });
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
                            constraints: context.phase9Constraints,
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

    private buildPhase9Constraints(
        baseConstraints: string[],
        phase9: {
            findings: string[];
            variables: RuntimeVariable[];
            retryRules: string[];
            validations: string[];
        }
    ): string[] {

        const variableNames =
            phase9.variables.map(x => x.name);

        const constraints = [
            ...baseConstraints,
            "Use SmartFillEngine and SmartDropdownEngine when textbox/dropdown actions are detected.",
            "Prefer SmartWaitEngine and WaitStrategy before interactions.",
            ...phase9.findings,
            variableNames.length > 0
                ? `Capture and reuse runtime variables: ${variableNames.join(", ")}`
                : "No mandatory runtime variable capture detected.",
            phase9.retryRules.length > 0
                ? `Generate business retry polling for transitions: ${phase9.retryRules.join(", ")}`
                : "Generate retry logic only when dynamic status transitions are detected.",
            phase9.validations.length > 0
                ? `Generate validations for: ${phase9.validations.join(", ")}`
                : "Generate validations only when explicitly requested by the user."
        ];

        return [...new Set(constraints)];

    }

    private detectRuntimeVariables(): RuntimeVariable[] {

        const filePath = path.join(process.cwd(), "AIRecorder", "code.ts");

        if (!fs.existsSync(filePath))
            return [];

        const code = fs.readFileSync(filePath, "utf8").toLowerCase();
        const variables: RuntimeVariable[] = [];

        const addVariable = (name: string, captureType: RuntimeVariable["captureType"]) => {
            variables.push({
                name,
                value: `{{${name}}}`,
                captureType,
                scope: "session",
                createdAt: new Date().toISOString()
            });
        };

        if (code.includes("transaction") && code.includes("id"))
            addVariable("transactionId", "TransactionId");

        if (code.includes("workflow") && code.includes("id"))
            addVariable("workflowId", "WorkflowId");

        if (code.includes("deal") && code.includes("id"))
            addVariable("dealId", "DealId");

        if (code.includes("amount"))
            addVariable("amount", "Amount");

        if (code.includes("user") && code.includes("name"))
            addVariable("userName", "UserName");

        if (code.includes("status"))
            addVariable("status", "InnerText");

        return variables;

    }

}
