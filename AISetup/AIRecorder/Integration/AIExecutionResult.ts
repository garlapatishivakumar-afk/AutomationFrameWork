import { IntelligenceResult } from "../Intelligence/FrameworkIntelligenceEngine";
import { PlanningResult } from "../Planner/PlannerModels";
import { FeedbackResult } from "./FeedbackResult";
import { GenerationResult } from "./GenerationResult";

export type PipelineStatus =
    | "Planning"
    | "Learning"
    | "Generating"
    | "Reviewing"
    | "Completed"
    | "Failed";

export interface AIExecutionResult {

    success: boolean;

    status: PipelineStatus;

    executionId: string;

    startedAt: string;

    completedAt: string;

    executionTimeMs: number;

    planning: PlanningResult | null;

    intelligence: IntelligenceResult | null;

    generation: GenerationResult | null;

    feedback: FeedbackResult | null;

    notes: string[];

}
