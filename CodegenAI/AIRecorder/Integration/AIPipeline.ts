import { AIExecutionContext } from "./AIExecutionContext";
import { AIExecutionResult } from "./AIExecutionResult";
import { AIOrchestrator } from "./AIOrchestrator";

export interface AIPipelineRequest {

    requestId: string;

    projectRoot: string;

    objective: string;

    query: string;

    templateName: string;

    constraints?: string[];

    featureName: string;

    pageName: string;

    application: string;

}

export class AIPipeline {

    private readonly orchestrator =
        new AIOrchestrator();

    public async run(request: AIPipelineRequest): Promise<AIExecutionResult> {

        const context: AIExecutionContext = {
            requestId: request.requestId,
            projectRoot: request.projectRoot,
            objective: request.objective,
            query: request.query,
            templateName: request.templateName,
            constraints: request.constraints ?? [],
            plannerContext: AIOrchestrator.createPlannerContext(
                request.projectRoot,
                request.objective,
                request.featureName,
                request.pageName,
                request.application
            )
        };

        return this.orchestrator.execute(context);

    }

}
