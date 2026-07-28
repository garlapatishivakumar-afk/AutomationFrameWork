import { WorkflowContext } from "./WorkflowContext";
import { WorkflowMetrics, WorkflowStageMetric } from "./WorkflowMetrics";
import { WorkflowResult } from "./WorkflowResult";
import { WorkflowStep } from "./WorkflowStep";

export class WorkflowExecutor {

    public async execute(
        steps: WorkflowStep[],
        context: WorkflowContext
    ): Promise<WorkflowResult> {

        const startedAtMs =
            Date.now();

        const stageMetrics: WorkflowStageMetric[] = [];
        const completedStages =
            new Set<WorkflowStep["stage"]>();
        const failedStages =
            new Set<WorkflowStep["stage"]>();

        for (const step of steps) {

            const maxRetries =
                step.maxRetries ?? 0;

            let success = false;
            let lastError: unknown;
            let retries = 0;

            const stageStart =
                Date.now();

            for (let attempt = 0; attempt <= maxRetries; attempt++) {

                try {

                    await step.execute(context);
                    success = true;
                    retries = attempt;
                    break;

                }
                catch (error) {

                    lastError = error;
                    retries = attempt;

                    if (attempt === maxRetries)
                        break;

                }

            }

            const stageEnd =
                Date.now();

            stageMetrics.push({
                stage: step.stage,
                startTime: new Date(stageStart).toISOString(),
                endTime: new Date(stageEnd).toISOString(),
                durationMs: stageEnd - stageStart,
                success,
                failure: success ? undefined : this.toError(lastError),
                retryCount: retries
            });

            if (success) {
                completedStages.add(step.stage);
            }
            else {
                failedStages.add(step.stage);
                context.errors.push(
                    `${step.stage}: ${this.toError(lastError)}`
                );
                break;
            }

        }

        const metrics: WorkflowMetrics = {
            stages: stageMetrics,
            totalDurationMs: Date.now() - startedAtMs
        };

        return {
            overallStatus:
                failedStages.size > 0
                    ? "Failed"
                    : context.approval?.approved === false
                        ? "Blocked"
                        : "Success",
            completedStages: [...completedStages],
            failedStages: [...failedStages],
            generatedFiles: context.generated?.manifest.generatedFiles ?? [],
            metrics,
            historyId: context.generated?.session.createdAt ?? null
        };

    }

    private toError(error: unknown): string {

        if (error instanceof Error)
            return error.message;

        return String(error);

    }

}
