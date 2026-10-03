import { WorkflowContext } from "./WorkflowContext";
import { WorkflowStage } from "./WorkflowStage";

export interface WorkflowStep {

    stage: WorkflowStage;

    maxRetries?: number;

    execute(context: WorkflowContext): Promise<void>;

}
