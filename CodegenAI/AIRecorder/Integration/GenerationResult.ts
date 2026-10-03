import { GenerationSummary } from "../Generator/GenerationSummary";
import { RecommendationResult } from "../Learning/RecommendationEngine";
import { ReviewResult } from "../Review/ReviewResult";
import { ApprovalResult } from "./ApprovalResult";
import { WorkflowResult } from "./WorkflowResult";

export interface GenerationResult {

    prompt: string;

    llmOutput: string;

    recommendations: RecommendationResult[];

    generationSummary: GenerationSummary;

    review: ReviewResult;

    fixes: string[];

    workflow?: WorkflowResult;

    approval?: ApprovalResult | null;

}
