import { ChangeDetector } from "./ChangeDetector";
import { ImpactReport } from "./ImpactReport";
import { PlannedAction } from "./PlannerModels";
import { RiskAnalyzer } from "./RiskAnalyzer";

export class ImpactAnalyzer {

    private readonly changeDetector =
        new ChangeDetector();

    private readonly riskAnalyzer =
        new RiskAnalyzer();

    public analyze(
        actions: PlannedAction[]
    ): ImpactReport {

        const changes =
            this.changeDetector.detect(actions);

        const risk =
            this.riskAnalyzer.score(actions);

        return {

            summary: `Detected ${changes.length} planned changes. Overall risk: ${risk}.`,

            items: actions.map(action => ({
                target: action.filePath,
                changeType: action.type,
                impactLevel: risk,
                reason: action.reason
            }))

        };

    }

}
