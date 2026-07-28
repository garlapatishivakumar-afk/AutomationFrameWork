import { WorkflowContext } from "./WorkflowContext";
import { WorkflowExecutor } from "./WorkflowExecutor";
import { WorkflowResult } from "./WorkflowResult";
import { WorkflowStep } from "./WorkflowStep";

export class WorkflowEngine {

    private readonly executor =
        new WorkflowExecutor();

    public async execute(
        context: WorkflowContext,
        steps: WorkflowStep[]
    ): Promise<WorkflowResult> {

        return this.executor.execute(steps, context);

    }

}
