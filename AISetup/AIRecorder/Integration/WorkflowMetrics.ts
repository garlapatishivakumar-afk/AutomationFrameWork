import { WorkflowStage } from "./WorkflowStage";

export interface WorkflowStageMetric {

    stage: WorkflowStage;

    startTime: string;

    endTime: string;

    durationMs: number;

    success: boolean;

    failure?: string;

    retryCount: number;

}

export interface WorkflowMetrics {

    stages: WorkflowStageMetric[];

    totalDurationMs: number;

}
