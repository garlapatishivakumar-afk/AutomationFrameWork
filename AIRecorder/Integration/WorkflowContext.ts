import { RecommendationResult } from "../Learning/RecommendationEngine";
import { ReviewResult } from "../Review/ReviewResult";
import { ArtifactGenerationPlan } from "./ArtifactGenerationPlan";
import { ApprovalResult } from "./ApprovalResult";
import { GenerationOrchestratorResult } from "./GenerationOrchestrator";
import { SessionQuestion } from "../Runtime/Questions/QuestionSession";
import { RuntimeVariable } from "../Runtime/Variables/RuntimeVariable";
import type { GenerationPipelineInput } from "./GenerationPipeline";
import { MultiArtifactGenerationOutput } from "./MultiArtifactGenerator";

export interface WorkflowContext {

    input: GenerationPipelineInput;

    recommendations: RecommendationResult[];

    retrievedCount: number;

    prompt: string;

    llmOutput: string;

    generationOutput: GenerationOrchestratorResult | null;

    review: ReviewResult | null;

    fixes: string[];

    plan: ArtifactGenerationPlan;

    approval: ApprovalResult | null;

    generated: MultiArtifactGenerationOutput | null;

    interactiveQuestions: SessionQuestion[];

    questionFindings: string[];

    runtimeVariables: RuntimeVariable[];

    businessRetryRules: string[];

    validationTargets: string[];

    phase9Constraints: string[];

    errors: string[];

}
