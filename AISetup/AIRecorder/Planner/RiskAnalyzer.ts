import { PlannedAction } from "./PlannerModels";

export class RiskAnalyzer {

    public score(
        actions: PlannedAction[]
    ): "Low" | "Medium" | "High" {

        const totalTokens =
            actions.reduce((sum, action) => sum + action.estimatedTokens, 0);

        if (totalTokens >= 2500)
            return "High";

        if (totalTokens >= 1200)
            return "Medium";

        return "Low";

    }

}
