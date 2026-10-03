import { RecommendationResult } from "../Learning/RecommendationEngine";
import { ReviewResult } from "../Review/ReviewResult";
import { ArtifactGenerationPlan } from "./ArtifactGenerationPlan";
import { ApprovalResult } from "./ApprovalResult";
import { GenerationOrchestratorResult } from "./GenerationOrchestrator";
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

    errors: string[];

}
