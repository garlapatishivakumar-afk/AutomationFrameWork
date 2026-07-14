import { PlannedAction } from "./PlannerModels";
import { ReuseAnalyzer } from "./ReuseAnalyzer";
import { ReuseResult } from "./ReuseResult";

export class ReusePlanner {

    private readonly reuseAnalyzer =
        new ReuseAnalyzer();

    public plan(
        actions: PlannedAction[],
        existingNames: string[]
    ): ReuseResult {

        return this.reuseAnalyzer.analyze(
            actions,
            existingNames
        );

    }

}
