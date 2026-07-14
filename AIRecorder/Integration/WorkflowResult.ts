import { WorkflowMetrics } from "./WorkflowMetrics";
import { WorkflowStage } from "./WorkflowStage";

export interface WorkflowResult {

    overallStatus: "Success" | "Failed" | "Blocked";

    completedStages: WorkflowStage[];

    failedStages: WorkflowStage[];

    generatedFiles: string[];

    metrics: WorkflowMetrics;

    historyId: string | null;

}
